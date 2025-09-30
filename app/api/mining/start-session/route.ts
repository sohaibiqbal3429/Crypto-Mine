import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Balance from "@/models/Balance"
import MiningSession from "@/models/MiningSession"
import Settings from "@/models/Settings"
import { getUserFromRequest } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const user = await User.findById(userPayload.userId)
    const balance = await Balance.findOne({ userId: user._id })
    const settings = await Settings.findOne()

    if (!user || !balance || !settings) {
      return NextResponse.json({ error: "Data not found" }, { status: 404 })
    }

    // Get or create mining session
    let miningSession = await MiningSession.findOne({ userId: user._id })
    if (!miningSession) {
      miningSession = await MiningSession.create({
        userId: user._id,
        isActive: false,
        earnedInCycle: 0,
        sessionStartedAt: null,
        nextEligibleAt: null,
      })
    }

    const requiredDeposit = settings.gating?.minDeposit ?? 30
    const hasMinimumDeposit = user.depositTotal >= requiredDeposit

    if (!hasMinimumDeposit) {
      return NextResponse.json(
        {
          error: `You need to deposit at least $${requiredDeposit} USDT before mining can start`,
          requiresDeposit: true,
          minDeposit: requiredDeposit,
        },
        { status: 403 },
      )
    }

    const canMine = user.depositTotal > 0 || balance.current > 0
    if (!canMine) {
      return NextResponse.json(
        {
          error: "You need to make a deposit first to start mining",
        },
        { status: 400 },
      )
    }

    // Calculate mining base amount
    const baseAmount = Math.max(user.depositTotal, balance.staked, requiredDeposit)

    return NextResponse.json({
      success: true,
      canMine: true,
      baseAmount,
      miningSession: {
        isActive: miningSession.isActive,
        earnedInCycle: miningSession.earnedInCycle,
        nextEligibleAt: miningSession.nextEligibleAt,
        sessionStartedAt: miningSession.sessionStartedAt,
      },
      userStats: {
        depositTotal: user.depositTotal,
        roiEarnedTotal: user.roiEarnedTotal,
        currentBalance: balance.current,
        totalEarning: balance.totalEarning,
      },
    })
  } catch (error) {
    console.error("Start mining session error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
