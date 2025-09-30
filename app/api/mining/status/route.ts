import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Balance from "@/models/Balance"
import MiningSession from "@/models/MiningSession"
import Settings from "@/models/Settings"
import { getUserFromRequest } from "@/lib/auth"
import { hasReachedROICap } from "@/lib/utils/referral"

export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const user = await User.findById(userPayload.userId)
    let balance = await Balance.findOne({ userId: user._id })
    const settings = await Settings.findOne()

    if (!user || !settings) {
      return NextResponse.json({ error: "Data not found" }, { status: 404 })
    }

    // Create balance if it doesn't exist
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

    // Get or create mining session
    let miningSession = await MiningSession.findOne({ userId: user._id })
    if (!miningSession) {
      miningSession = await MiningSession.create({ userId: user._id })
    }

    const requiredDeposit = settings.gating?.minDeposit ?? 30
    const hasMinimumDeposit = user.depositTotal >= requiredDeposit

    const now = new Date()
    const canMine = (!miningSession.nextEligibleAt || now >= miningSession.nextEligibleAt) && hasMinimumDeposit
    const roiCapReached = hasReachedROICap(user.roiEarnedTotal, user.depositTotal, settings.mining.roiCap)
    const baseAmount = hasMinimumDeposit ? Math.max(user.depositTotal, balance.staked, requiredDeposit) : 0

    let timeLeft = 0
    if (miningSession.nextEligibleAt && now < miningSession.nextEligibleAt) {
      timeLeft = Math.ceil((miningSession.nextEligibleAt.getTime() - now.getTime()) / 1000)
    }

    return NextResponse.json({
      success: true,
      canMine: canMine && !roiCapReached,
      roiCapReached,
      requiresDeposit: !hasMinimumDeposit,
      minDeposit: requiredDeposit,
      timeLeft,
      nextEligibleAt: miningSession.nextEligibleAt?.toISOString() || null,
      lastClickAt: miningSession.lastClickAt?.toISOString() || null,
      earnedInCycle: miningSession.earnedInCycle || 0,
      baseAmount,
      miningSettings: {
        minPct: settings.mining.minPct,
        maxPct: settings.mining.maxPct,
        roiCap: settings.mining.roiCap,
      },
      userStats: {
        depositTotal: user.depositTotal,
        roiEarnedTotal: user.roiEarnedTotal,
        currentBalance: balance.current,
        totalEarning: balance.totalEarning,
        roiProgress:
          user.depositTotal > 0 ? (user.roiEarnedTotal / (user.depositTotal * settings.mining.roiCap)) * 100 : 0,
      },
    })
  } catch (error) {
    console.error("Mining status error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
