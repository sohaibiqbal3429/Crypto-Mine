import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { getMiningStatus, MiningActionError } from "@/lib/services/mining"

export async function POST(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const status = await getMiningStatus(userPayload.userId)
    if (status.requiresDeposit) {
      return NextResponse.json(
        {
          error: `You need to deposit at least $${status.minDeposit} USDT before mining can start`,
          requiresDeposit: true,
          minDeposit: status.minDeposit,
        },
        { status: 403 },
      )
    }

    if (!status.canMine) {
      return NextResponse.json(
        {
          error: "You need to make a deposit first to start mining",
        },
        { status: 400 },
      )
    }

    return NextResponse.json({
      success: true,
      canMine: status.canMine,
      baseAmount: status.baseAmount,
      miningSession: {
        isActive: status.canMine,
        earnedInCycle: status.earnedInCycle,
        nextEligibleAt: status.nextEligibleAt,
        sessionStartedAt: status.lastClickAt,
      },
      userStats: status.userStats,
    })
  } catch (error: any) {
    if (error instanceof MiningActionError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Start mining session error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
