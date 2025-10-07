import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { BlindBoxServiceError, finalizeBlindBoxRound } from "@/lib/services/blindbox"
import User from "@/models/User"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = getUserFromRequest(request)
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminUser = await User.findById(payload.userId).select("role")
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const roundId = params.id
    if (!roundId) {
      return NextResponse.json({ error: "Round ID is required" }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const winnerId = typeof body.winnerId === "string" ? body.winnerId : undefined

    const round = await finalizeBlindBoxRound(roundId, {
      trigger: "manual",
      winnerId,
      startNextRound: body.startNextRound !== false,
    })

    return NextResponse.json({
      round: round
        ? {
            id: round._id.toString(),
            status: round.status,
            winnerUserId: round.winnerUserId ? round.winnerUserId.toString() : null,
          }
        : null,
    })
  } catch (error: any) {
    if (error instanceof BlindBoxServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Admin blind box draw error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
