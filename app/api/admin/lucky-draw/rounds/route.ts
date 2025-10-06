import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { listLuckyDrawRounds, LuckyDrawServiceError } from "@/lib/services/lucky-draw"
import User from "@/models/User"

export async function GET(request: NextRequest) {
  try {
    const payload = getUserFromRequest(request)
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminUser = await User.findById(payload.userId).select("role")
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get("status")
    const limitParam = searchParams.get("limit")
    const limit = Math.min(100, Math.max(1, Number.parseInt(limitParam || "20", 10)))

    const rounds = await listLuckyDrawRounds(
      statusParam === "open" || statusParam === "closed" || statusParam === "completed"
        ? (statusParam as any)
        : undefined,
      limit,
    )

    return NextResponse.json({
      rounds: rounds.map((round) => ({
        id: round._id.toString(),
        status: round.status,
        entryFee: round.entryFee,
        prize: round.prize,
        startsAt: round.startsAt.toISOString(),
        endsAt: round.endsAt.toISOString(),
        totalEntries: round.totalEntries,
        winnerUserId: round.winnerUserId ? round.winnerUserId.toString() : null,
        winnerSnapshot: round.winnerSnapshot
          ? {
              ...round.winnerSnapshot,
              creditedAt: round.winnerSnapshot.creditedAt
                ? new Date(round.winnerSnapshot.creditedAt).toISOString()
                : null,
            }
          : null,
        payoutTxId: round.payoutTxId ? round.payoutTxId.toString() : null,
        completedAt: round.completedAt ? round.completedAt.toISOString() : null,
      })),
    })
  } catch (error: any) {
    if (error instanceof LuckyDrawServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Admin lucky draw rounds error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
