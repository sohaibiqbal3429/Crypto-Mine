import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import { getUserFromRequest } from "@/lib/auth"
import { getTeamStats } from "@/lib/utils/commission"

export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const teamStats = await getTeamStats(userPayload.userId)

    return NextResponse.json({
      currentLevel: 0,
      currentRule: null,
      nextRule: null,
      levelProgress: null,
      teamStats,
      allRules: [],
      directActiveCount: teamStats.directActive,
      totalActiveDirects: teamStats.directActive,
      lastLevelUpAt: null,
      message: "Level-based progression has been retired. Focus on supporting your direct and second-level teams.",
    })
  } catch (error) {
    console.error("Level eligibility error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
