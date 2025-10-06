import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import CommissionRule from "@/models/CommissionRule"
import User from "@/models/User"
import { getUserFromRequest } from "@/lib/auth"
import {
  LEVEL_PROGRESSION_THRESHOLDS,
  calculateUserLevel,
  getTeamStats,
} from "@/lib/utils/commission"

export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const [currentLevel, teamStats, allRules, userDoc] = await Promise.all([
      calculateUserLevel(userPayload.userId),
      getTeamStats(userPayload.userId),
      CommissionRule.find().sort({ level: 1 }),
      User.findById(userPayload.userId),
    ])

    // Calculate progress to next level
    const nextRule = allRules.find((rule) => rule.level > currentLevel)
    const currentRule = allRules.find((rule) => rule.level === currentLevel)

    let levelProgress: {
      currentActive: number
      requiredActive: number
      progress: number
      nextLevel: number
    } | null = null

    if (currentLevel < LEVEL_PROGRESSION_THRESHOLDS.length) {
      const requiredActive = LEVEL_PROGRESSION_THRESHOLDS[currentLevel]
      levelProgress = {
        currentActive: userDoc?.directActiveCount ?? 0,
        requiredActive,
        progress: requiredActive > 0 ? Math.min(((userDoc?.directActiveCount ?? 0) / requiredActive) * 100, 100) : 0,
        nextLevel: currentLevel + 1,
      }
    }

    return NextResponse.json({
      currentLevel,
      currentRule,
      nextRule,
      levelProgress,
      teamStats,
      allRules,
      directActiveCount: userDoc?.directActiveCount ?? 0,
      totalActiveDirects: userDoc?.totalActiveDirects ?? 0,
      lastLevelUpAt: userDoc?.lastLevelUpAt ?? null,
      message:
        "You must add new active referrals (≥ 80 USDT) after each level to progress further. Your previous referrals do not count toward the next level.",
    })
  } catch (error) {
    console.error("Level eligibility error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
