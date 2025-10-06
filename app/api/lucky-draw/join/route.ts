import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import {
  getCurrentRoundSummaryForUser,
  joinLuckyDrawRound,
  LuckyDrawServiceError,
} from "@/lib/services/lucky-draw"

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const roundId = typeof body.roundId === "string" ? body.roundId.trim() : ""

    if (!roundId) {
      return NextResponse.json({ error: "roundId is required" }, { status: 400 })
    }

    await joinLuckyDrawRound(user.userId, roundId)
    const summary = await getCurrentRoundSummaryForUser(user.userId)

    return NextResponse.json({
      success: true,
      round: summary.round ? summary.round.id : null,
      hasJoined: summary.hasJoined,
      totalEntries: summary.entries,
      nextDrawAt: summary.nextDrawAt ? summary.nextDrawAt.toISOString() : null,
    })
  } catch (error: any) {
    if (error instanceof LuckyDrawServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Lucky draw join error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
