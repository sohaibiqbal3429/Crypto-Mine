import { type NextRequest, NextResponse } from "next/server"

import dbConnect from "@/lib/mongodb"
import { getUserFromRequest } from "@/lib/auth"
import { listTeamRewardHistory } from "@/lib/services/team-earnings"

export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const history = await listTeamRewardHistory(userPayload.userId)

    return NextResponse.json({
      entries: history.map((entry) => ({
        ...entry,
        occurredAt: entry.occurredAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error("Team rewards history error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

