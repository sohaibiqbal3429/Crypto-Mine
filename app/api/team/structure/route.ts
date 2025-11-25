import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import { getUserFromRequest } from "@/lib/auth"
import { buildTeamTree, getTeamStats } from "@/lib/utils/commission"

export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const [teamTree, teamStats] = await Promise.all([
      buildTeamTree(userPayload.userId, 3), // Limit to 3 levels for performance
      getTeamStats(userPayload.userId),
    ])

    return NextResponse.json({
      teamTree,
      teamStats,
    })
  } catch (error) {
    console.error("Team structure error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
