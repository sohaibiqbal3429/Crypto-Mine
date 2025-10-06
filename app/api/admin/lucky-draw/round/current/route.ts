import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import {
  ensureCurrentLuckyDrawRound,
  getRoundParticipants,
  LuckyDrawServiceError,
} from "@/lib/services/lucky-draw"
import User from "@/models/User"
import LuckyDrawRound from "@/models/LuckyDrawRound"

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

    const { round, config } = await ensureCurrentLuckyDrawRound()
    const pendingClosedRound = await LuckyDrawRound.findOne({ status: "closed" }).sort({ endsAt: 1 })
    const activeRound = round ?? pendingClosedRound ?? null

    const participants = activeRound ? await getRoundParticipants(activeRound._id.toString()) : []

    return NextResponse.json({
      openRound: round
        ? {
            id: round._id.toString(),
            status: round.status,
            entryFee: round.entryFee,
            prize: round.prize,
            startsAt: round.startsAt.toISOString(),
            endsAt: round.endsAt.toISOString(),
            totalEntries: round.totalEntries,
          }
        : null,
      pendingClosedRound: pendingClosedRound
        ? {
            id: pendingClosedRound._id.toString(),
            status: pendingClosedRound.status,
            entryFee: pendingClosedRound.entryFee,
            prize: pendingClosedRound.prize,
            startsAt: pendingClosedRound.startsAt.toISOString(),
            endsAt: pendingClosedRound.endsAt.toISOString(),
            totalEntries: pendingClosedRound.totalEntries,
          }
        : null,
      participants,
      config,
    })
  } catch (error: any) {
    if (error instanceof LuckyDrawServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Admin lucky draw current round error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
