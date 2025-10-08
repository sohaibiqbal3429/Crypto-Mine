import { type NextRequest, NextResponse } from "next/server"

import { runGiftBoxAutoDraw } from "@/lib/services/giftbox"

export const dynamic = "force-dynamic"

export async function POST(_request: NextRequest) {
  try {
    const cycle = await runGiftBoxAutoDraw()
    return NextResponse.json({
      cycle: cycle
        ? {
            id: cycle._id.toString(),
            status: cycle.status,
            endTime: cycle.endTime.toISOString(),
            totalParticipants: cycle.totalParticipants,
          }
        : null,
    })
  } catch (error) {
    console.error("Gift box ensure cycle error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
