import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Balance from "@/models/Balance"
import Transaction from "@/models/Transaction"
import MiningSession from "@/models/MiningSession"
import Notification from "@/models/Notification"
import Settings from "@/models/Settings"
import { getUserFromRequest } from "@/lib/auth"
import { calculateMiningProfit, hasReachedROICap } from "@/lib/utils/referral"

const DEFAULT_MINING_SETTINGS = {
  minPct: 1.5,
  maxPct: 5,
  roiCap: 3,
}

export async function POST(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const user = await User.findById(userPayload.userId)
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    let balance = await Balance.findOne({ userId: user._id })

    const settingsDoc = await Settings.findOne()
    const miningSettings = {
      minPct: settingsDoc?.mining?.minPct ?? DEFAULT_MINING_SETTINGS.minPct,
      maxPct: settingsDoc?.mining?.maxPct ?? DEFAULT_MINING_SETTINGS.maxPct,
      roiCap: settingsDoc?.mining?.roiCap ?? DEFAULT_MINING_SETTINGS.roiCap,
    }

    if (!balance) {
      balance = await Balance.create({
        userId: user._id,
        current: 0,
        totalBalance: 0,
        totalEarning: 0,
        lockedCapital: 0,
        staked: 0,
        pendingWithdraw: 0,
      })
    }

    const roiCapLimit = user.depositTotal > 0 ? user.depositTotal * miningSettings.roiCap : null

    if (roiCapLimit !== null && hasReachedROICap(user.roiEarnedTotal, user.depositTotal, miningSettings.roiCap)) {
      return NextResponse.json(
        {
          error: `ROI cap reached (${miningSettings.roiCap}x)`,
          roiCapReached: true,
          roiEarnedTotal: user.roiEarnedTotal,
          depositTotal: user.depositTotal,
        },
        { status: 400 },
      )
    }

    let miningSession = await MiningSession.findOne({ userId: user._id })
    if (!miningSession) {
      miningSession = await MiningSession.create({ userId: user._id })
    }

    const now = new Date()
    if (miningSession.nextEligibleAt && now < miningSession.nextEligibleAt) {
      const timeLeft = Math.ceil((miningSession.nextEligibleAt.getTime() - now.getTime()) / 1000)
      return NextResponse.json(
        {
          error: "Mining cooldown active",
          timeLeft,
          nextEligibleAt: miningSession.nextEligibleAt.toISOString(),
        },
        { status: 400 },
      )
    }

    const baseAmount = Math.max(user.depositTotal, balance.staked, 30)
    const profit = calculateMiningProfit(baseAmount, miningSettings.minPct, miningSettings.maxPct)

    const newRoiTotal = user.roiEarnedTotal + profit
    let finalProfit = profit
    let roiCapReached = false

    if (roiCapLimit !== null && newRoiTotal > roiCapLimit) {
      const remainingProfit = roiCapLimit - user.roiEarnedTotal
      if (remainingProfit <= 0) {
        return NextResponse.json(
          {
            error: `ROI cap reached (${miningSettings.roiCap}x)`,
            roiCapReached: true,
          },
          { status: 400 },
        )
      }
      finalProfit = remainingProfit
      roiCapReached = true
    }

    const newBalanceCurrent = (balance.current ?? 0) + finalProfit

    await Promise.all([
      Balance.updateOne(
        { userId: user._id },
        {
          $inc: {
            current: finalProfit,
            totalBalance: finalProfit,
            totalEarning: finalProfit,
          },
        },
      ),
      User.updateOne({ _id: user._id }, { $inc: { roiEarnedTotal: finalProfit } }),
    ])

    await Transaction.create({
      userId: user._id,
      type: "earn",
      amount: finalProfit,
      status: "approved",
      meta: {
        source: "mining",
        baseAmount,
        profitPct: (finalProfit / baseAmount) * 100,
        roiCapReached,
        originalProfit: profit,
      },
    })

    const nextEligible = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    await MiningSession.updateOne(
      { userId: user._id },
      {
        lastClickAt: now,
        nextEligibleAt: nextEligible,
        earnedInCycle: finalProfit,
      },
    )

    await Notification.create({
      userId: user._id,
      kind: "mining-reward",
      title: "Mining Reward Earned",
      body: `You earned $${finalProfit.toFixed(2)} from mining! ${roiCapReached ? "ROI cap reached." : ""}`,
    })

    return NextResponse.json({
      success: true,
      profit: finalProfit,
      baseAmount,
      profitPct: (finalProfit / baseAmount) * 100,
      roiCapReached,
      nextEligibleAt: nextEligible.toISOString(),
      newBalance: newBalanceCurrent,
      roiEarnedTotal: user.roiEarnedTotal + finalProfit,
    })
  } catch (error) {
    console.error("Mining click error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
