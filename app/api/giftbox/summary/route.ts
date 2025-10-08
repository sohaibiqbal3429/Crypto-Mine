import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { GiftBoxServiceError, getGiftBoxSummaryForUser } from "@/lib/services/giftbox"

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const summary = await getGiftBoxSummaryForUser(user.userId)

    return NextResponse.json({
      cycle: summary.cycle,
      previousCycle: summary.previousCycle,
      nextDrawAt: summary.nextDrawAt,
      participants: summary.participants,
      config: summary.config,
      userStatus: summary.userStatus,
    })
  } catch (error: any) {
    if (error instanceof GiftBoxServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Gift box summary error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
