import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import {
  getCurrentRoundSummaryForUser,
  LuckyDrawServiceError,
} from "@/lib/services/lucky-draw"

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const summary = await getCurrentRoundSummaryForUser(user.userId)

    return NextResponse.json({
      round: summary.round
        ? {
            id: summary.round._id.toString(),
            status: summary.round.status,
            entryFee: summary.round.entryFee,
            prize: summary.round.prize,
            startsAt: summary.round.startsAt.toISOString(),
            endsAt: summary.round.endsAt.toISOString(),
            totalEntries: summary.entries,
            hasJoined: summary.hasJoined,
          }
        : null,
      config: summary.config,
      nextDrawAt: summary.nextDrawAt ? summary.nextDrawAt.toISOString() : null,
      previousRound: summary.previousRound
        ? {
            id: summary.previousRound._id.toString(),
            status: summary.previousRound.status,
            prize: summary.previousRound.prize,
            totalEntries: summary.previousRound.totalEntries,
            winnerSnapshot: summary.previousRound.winnerSnapshot
              ? {
                  ...summary.previousRound.winnerSnapshot,
                  creditedAt: summary.previousRound.winnerSnapshot.creditedAt
                    ? new Date(summary.previousRound.winnerSnapshot.creditedAt).toISOString()
                    : null,
                }
              : null,
            endsAt: summary.previousRound.endsAt.toISOString(),
            completedAt: (summary.previousRound.completedAt ?? summary.previousRound.endsAt).toISOString(),
          }
        : null,
    })
  } catch (error: any) {
    if (error instanceof LuckyDrawServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Lucky draw current round error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
