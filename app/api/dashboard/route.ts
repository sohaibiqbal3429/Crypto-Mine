import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Balance from "@/models/Balance"
import MiningSession from "@/models/MiningSession"
import Settings from "@/models/Settings"
import { getUserFromRequest } from "@/lib/auth"

export async function GET(request: NextRequest) {
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
    if (!balance) {
      balance = await Balance.create({
        userId: user._id,
        current: 0,
        totalBalance: 0,
        totalEarning: 0,
        lockedCapital: 0,
        staked: 0,
        pendingWithdraw: 0,
        teamRewardsAvailable: 0,
        teamRewardsClaimed: 0,
      })
    }

    let miningSession = await MiningSession.findOne({ userId: user._id })
    if (!miningSession) {
      miningSession = await MiningSession.create({ userId: user._id })
    }

    const settings = await Settings.findOne()

    const activeMembers = await User.countDocuments({
      referredBy: user._id,
      depositTotal: { $gte: 80 },
    })

    const now = new Date()
    const nextEligibleAt = miningSession.nextEligibleAt ?? now
    const minDeposit = settings?.gating?.minDeposit ?? 30
    const hasMinimumDeposit = (user.depositTotal ?? 0) >= minDeposit
    const canMine = hasMinimumDeposit && now >= nextEligibleAt

    return NextResponse.json({
      kpis: {
        totalEarning: balance.totalEarning ?? 0,
        totalBalance: balance.totalBalance ?? 0,
        currentBalance: balance.current ?? 0,
        activeMembers,
        totalWithdraw: user.withdrawTotal ?? 0,
        pendingWithdraw: balance.pendingWithdraw ?? 0,
        teamReward: balance.teamRewardsAvailable ?? 0,
      },
      mining: {
        canMine,
        requiresDeposit: !hasMinimumDeposit,
        minDeposit,
        nextEligibleAt: nextEligibleAt.toISOString(),
        earnedInCycle: miningSession.earnedInCycle ?? 0,
      },
      user: {
        level: user.level ?? 0,
        referralCode: user.referralCode ?? "",
        roiEarnedTotal: user.roiEarnedTotal ?? 0,
        depositTotal: user.depositTotal ?? 0,
      },
    })
  } catch (error) {
    console.error("Dashboard error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
