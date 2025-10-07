import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import {
  BLIND_BOX_CONSTANTS,
  BlindBoxServiceError,
  getBlindBoxSummaryForUser,
} from "@/lib/services/blindbox"

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const summary = await getBlindBoxSummaryForUser(user.userId)

    return NextResponse.json({
      round: summary.round,
      previousRound: summary.previousRound,
      nextDrawAt: summary.nextDrawAt,
      participants: summary.participants,
      config: summary.config,
      userStatus: summary.userStatus,
      constants: BLIND_BOX_CONSTANTS,
    })
  } catch (error: any) {
    if (error instanceof BlindBoxServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Blind box summary error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
