import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import {
  finalizeLuckyDrawRound,
  LuckyDrawServiceError,
} from "@/lib/services/lucky-draw"
import User from "@/models/User"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = getUserFromRequest(request)
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminUser = await User.findById(payload.userId)
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const roundId = params.id
    if (!roundId) {
      return NextResponse.json({ error: "Round id missing" }, { status: 400 })
    }

    const round = await finalizeLuckyDrawRound(roundId, { trigger: "manual" })

    if (!round) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 })
    }

    return NextResponse.json({
      round: {
        id: String(round._id),
        status: round.status,
        entryFee: round.entryFee,
        prize: round.prize,
        startsAt: round.startsAt.toISOString(),
        endsAt: round.endsAt.toISOString(),
        totalEntries: round.totalEntries,
        winnerUserId: round.winnerUserId ? round.winnerUserId.toString() : null,
        payoutTxId: round.payoutTxId ? round.payoutTxId.toString() : null,
        completedAt: round.completedAt ? round.completedAt.toISOString() : null,
        winnerSnapshot: round.winnerSnapshot
          ? {
              ...round.winnerSnapshot,
              creditedAt: round.winnerSnapshot.creditedAt
                ? new Date(round.winnerSnapshot.creditedAt).toISOString()
                : null,
            }
          : null,
      },
    })
  } catch (error: any) {
    if (error instanceof LuckyDrawServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Admin lucky draw draw-now error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
