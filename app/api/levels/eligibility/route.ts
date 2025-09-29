import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import CommissionRule from "@/models/CommissionRule"
import { getUserFromRequest } from "@/lib/auth"
import { calculateUserLevel, getTeamStats } from "@/lib/utils/commission"

export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const [currentLevel, teamStats, allRules] = await Promise.all([
      calculateUserLevel(userPayload.userId),
      getTeamStats(userPayload.userId),
      CommissionRule.find().sort({ level: 1 }),
    ])

    // Calculate progress to next level
    const nextRule = allRules.find((rule) => rule.level > currentLevel)
    const currentRule = allRules.find((rule) => rule.level === currentLevel)

    const levelProgress = nextRule
      ? {
          currentActive: teamStats.activeMembers,
          requiredActive: nextRule.activeMin,
          progress: Math.min((teamStats.activeMembers / nextRule.activeMin) * 100, 100),
          nextLevel: nextRule.level,
        }
      : null

    return NextResponse.json({
      currentLevel,
      currentRule,
      nextRule,
      levelProgress,
      teamStats,
      allRules,
    })
  } catch (error) {
    console.error("Level eligibility error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
