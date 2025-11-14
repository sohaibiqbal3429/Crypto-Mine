import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import { getUserFromRequest } from "@/lib/auth"
import {
  calculateUserLevel,
  getTeamStats,
} from "@/lib/utils/commission"
import {
  getNextLevelRequirement,
  LEVEL_PROGRESS_REQUIREMENTS,
  QUALIFYING_DIRECT_DEPOSIT,
} from "@/lib/utils/leveling"
import CommissionRule from "@/models/CommissionRule"
import User from "@/models/User"

const LEVEL_REFRESH_MAX_AGE_MS = 60_000

export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const userId = userPayload.userId

    const selection = "level directActiveCount totalActiveDirects lastLevelUpAt levelEvaluatedAt"

    let user = await User.findById(userId).select(selection).lean()
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const evaluatedAt = user.levelEvaluatedAt ? new Date(user.levelEvaluatedAt).getTime() : 0
    const now = Date.now()
    const shouldRefreshLevel = !evaluatedAt || now - evaluatedAt > LEVEL_REFRESH_MAX_AGE_MS

    if (shouldRefreshLevel) {
      await calculateUserLevel(userId, { persist: true, notify: false })
      user = await User.findById(userId).select(selection).lean()
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }
    }

    const [teamStats, commissionRules] = await Promise.all([
      getTeamStats(userId, { forceRefresh: shouldRefreshLevel }),
      CommissionRule.find().sort({ level: 1 }).lean(),
    ])

    const currentLevel = Number.isFinite(user.level) ? Number(user.level) : 0
    const currentRule = commissionRules.find((rule) => rule.level === currentLevel) ?? null
    const nextRule = commissionRules.find((rule) => rule.level === currentLevel + 1) ?? null
    const requiredActive = getNextLevelRequirement(currentLevel)

    const fallbackDirectActive = Number.isFinite(teamStats?.directActive)
      ? Number(teamStats.directActive)
      : 0
    const directActiveCount = Number.isFinite(user.directActiveCount)
      ? Number(user.directActiveCount)
      : fallbackDirectActive
    const totalActiveDirects = Number.isFinite(user.totalActiveDirects)
      ? Number(user.totalActiveDirects)
      : fallbackDirectActive
    const lastLevelUpAt = user.lastLevelUpAt ? new Date(user.lastLevelUpAt).toISOString() : null

    let levelProgress: {
      currentActive: number
      requiredActive: number
      progress: number
      nextLevel: number
    } | null = null

    let message: string

    if (requiredActive) {
      const progressPct = Math.min(100, Math.max(0, (directActiveCount / requiredActive) * 100))
      levelProgress = {
        currentActive: directActiveCount,
        requiredActive,
        progress: Number.isFinite(progressPct) ? progressPct : 0,
        nextLevel: currentLevel + 1,
      }

      const remaining = Math.max(requiredActive - directActiveCount, 0)
      message =
        remaining === 0
          ? `Requirements met! Level ${currentLevel + 1} will update once the system finishes syncing.`
          : `Activate ${remaining} more direct referral${remaining === 1 ? "" : "s"} with at least ${QUALIFYING_DIRECT_DEPOSIT} USDT in deposits to reach Level ${currentLevel + 1}.`
    } else {
      const maxRequirement = LEVEL_PROGRESS_REQUIREMENTS[LEVEL_PROGRESS_REQUIREMENTS.length - 1]
      message =
        currentLevel >= LEVEL_PROGRESS_REQUIREMENTS.length
          ? `You've unlocked the highest level. Maintain ${maxRequirement} active directs to keep Level ${currentLevel} benefits.`
          : "Invite new members with qualifying deposits to progress through the levels."
    }

    return NextResponse.json({
      currentLevel,
      currentRule,
      nextRule,
      levelProgress,
      teamStats,
      allRules: commissionRules,
      directActiveCount,
      totalActiveDirects,
      lastLevelUpAt,
      message,
    })
  } catch (error) {
    console.error("Level eligibility error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
