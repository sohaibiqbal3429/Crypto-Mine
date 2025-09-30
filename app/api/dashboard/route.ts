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

    // Get user data
    const user = await User.findById(userPayload.userId)
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Get balance data
    const balance = await Balance.findOne({ userId: user._id })
    if (!balance) {
      return NextResponse.json({ error: "Balance not found" }, { status: 404 })
    }

    // Get mining session
    const [miningSession, settings] = await Promise.all([
      MiningSession.findOne({ userId: user._id }),
      Settings.findOne(),
    ])

    // Count active team members (users who deposited >= 80 USDT)
    const activeMembers = await User.countDocuments({
      referredBy: user._id,
      depositTotal: { $gte: 80 },
    })

    // Calculate team reward (simplified - would need more complex logic for actual team structure)
    const teamReward = user.level * 100 // Placeholder calculation

    // Get next mining eligible time
    const now = new Date()
    const nextEligibleAt = miningSession?.nextEligibleAt || now
    const minDeposit = settings?.gating?.minDeposit ?? 30
    const hasMinimumDeposit = user.depositTotal >= minDeposit
    const canMine = hasMinimumDeposit && now >= nextEligibleAt

    return NextResponse.json({
      kpis: {
        totalEarning: balance.totalEarning,
        totalBalance: balance.totalBalance,
        currentBalance: balance.current,
        activeMembers,
        totalWithdraw: user.withdrawTotal,
        pendingWithdraw: balance.pendingWithdraw,
        teamReward,
      },
      mining: {
        canMine,
        requiresDeposit: !hasMinimumDeposit,
        minDeposit,
        nextEligibleAt: nextEligibleAt.toISOString(),
        earnedInCycle: miningSession?.earnedInCycle || 0,
      },
      user: {
        level: user.level,
        referralCode: user.referralCode,
        roiEarnedTotal: user.roiEarnedTotal,
        depositTotal: user.depositTotal,
      },
    })
  } catch (error) {
    console.error("Dashboard error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
