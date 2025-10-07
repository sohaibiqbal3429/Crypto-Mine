import { type NextRequest, NextResponse } from "next/server"

import { runBlindBoxAutoDraw } from "@/lib/services/blindbox"

export const dynamic = "force-dynamic"

export async function POST(_request: NextRequest) {
  try {
    const round = await runBlindBoxAutoDraw()
    return NextResponse.json({
      round: round
        ? {
            id: round._id.toString(),
            status: round.status,
            endTime: round.endTime.toISOString(),
            totalParticipants: round.totalParticipants,
          }
        : null,
    })
  } catch (error) {
    console.error("Blind box ensure round error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
