import mongoose from "mongoose"

import dbConnect from "@/lib/mongodb"
import Balance from "@/models/Balance"
import TeamDailyProfit from "@/models/TeamDailyProfit"
import Transaction from "@/models/Transaction"
import User from "@/models/User"
import { getPolicyEffectiveAt, isPolicyEffectiveFor } from "@/lib/utils/policy"

interface DailyOverrideResult {
  userId: string
  level: 1 | 2
  amount: number
  memberId: string
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function startOfPreviousUtcDay(date: Date): Date {
  const start = startOfUtcDay(date)
  start.setUTCDate(start.getUTCDate() - 1)
  return start
}

function endOfPreviousUtcDay(date: Date): Date {
  const end = startOfUtcDay(date)
  end.setUTCDate(end.getUTCDate() - 1)
  end.setUTCHours(23, 59, 59, 999)
  return end
}

const PLATFORM_DECIMALS = 4

function roundTo(amount: number, decimals: number): number {
  if (!Number.isFinite(amount)) {
    return 0
  }

  const factor = 10 ** decimals
  return Math.round(amount * factor) / factor
}

function roundPlatform(amount: number): number {
  return roundTo(amount, PLATFORM_DECIMALS)
}

function normaliseObjectId(value: mongoose.Types.ObjectId | string | null | undefined): string | null {
  if (!value) {
    return null
  }

  if (typeof value === "string") {
    return value
  }

  if (typeof (value as { toHexString?: () => string }).toHexString === "function") {
    return (value as { toHexString: () => string }).toHexString()
  }

  if (typeof (value as { toString?: () => string }).toString === "function") {
    const str = (value as { toString: () => string }).toString()
    if (str && str !== "[object Object]") {
      return str
    }
  }

  if (typeof (value as { buffer?: ArrayLike<number> }).buffer === "object") {
    const bufferLike = (value as { buffer?: ArrayLike<number> }).buffer
    const bytes = Array.from(bufferLike ?? [])
    if (bytes.length > 0) {
      return Buffer.from(bytes).toString("hex")
    }
  }

  return null
}

function toObjectIdString(value: mongoose.Types.ObjectId | string | null | undefined): string | null {
  return normaliseObjectId(value)
}

function toObjectId(value: string): mongoose.Types.ObjectId | null {
  if (!mongoose.isValidObjectId(value)) {
    return null
  }

  return new mongoose.Types.ObjectId(value)
}

async function creditDailyOverride(options: {
  recipientId: string | null
  level: 1 | 2
  baseAmount: number
  memberId: string
  memberName?: string | null
  dayKey: string
  postedAt: Date
}): Promise<DailyOverrideResult | null> {
  const { recipientId, level, baseAmount, memberId, memberName, dayKey, postedAt } = options
  if (!recipientId) {
    return null
  }

  const amount = roundPlatform(baseAmount * 0.01)
  if (amount <= 0) {
    return null
  }

  if (!isPolicyEffectiveFor(postedAt)) {
    return null
  }

  const uniqueKey = `${recipientId}|${dayKey}|${level === 1 ? "ovrL1" : "ovrL2"}|${memberId}`
  const userObjectId = new mongoose.Types.ObjectId(recipientId)

  const existing = await Transaction.findOne({
    userId: userObjectId,
    "meta.uniqueKey": uniqueKey,
  })

  if (existing) {
    console.info("[commission-engine] duplicate_prevented", {
      event_id: uniqueKey,
      level: level === 1 ? "L1" : "L2",
      source: "daily",
    })
    return null
  }

  let balanceUpdated = false

  const attemptUpdate = async (filter: Record<string, unknown>) => {
    if (balanceUpdated) return
    const result = await Balance.updateOne(
      filter,
      {
        $inc: {
          teamRewardsAvailable: amount,
        },
      },
    )

    if ((result as any)?.modifiedCount > 0 || (result as any)?.matchedCount > 0) {
      balanceUpdated = true
    }
  }

  await attemptUpdate({ userId: recipientId })
  if (!balanceUpdated) {
    await attemptUpdate({ userId: userObjectId })
  }

  if (!balanceUpdated) {
    await Balance.create({
      userId: userObjectId,
      current: 0,
      totalBalance: 0,
      totalEarning: 0,
      teamRewardsClaimed: 0,
      teamRewardsAvailable: amount,
    } as any)
  }

  await Transaction.create({
    userId: userObjectId,
    type: "teamReward",
    amount,
    status: "approved",
    claimable: true,
    meta: {
      source: "daily_team_reward",
      overrideKind: level === 1 ? "DAILY_OVERRIDE_L1" : "DAILY_OVERRIDE_L2",
      overridePct: 1,
      level,
      baseProfit: roundPlatform(baseAmount),
      memberId,
      memberName: memberName ?? null,
      uniqueKey,
      day: dayKey,
      eventId: uniqueKey,
    },
    createdAt: postedAt,
    updatedAt: postedAt,
  } as any)

  console.info("[commission-engine] credit", {
    event_id: uniqueKey,
    level: level === 1 ? "L1" : "L2",
    percentage: 1,
    base_amount: roundPlatform(baseAmount),
    source: "daily",
  })

  return { userId: recipientId, level, amount, memberId }
}

export async function payDailyTeamProfit(date: Date = new Date()): Promise<DailyOverrideResult[]> {
  await dbConnect()

  const windowStart = startOfPreviousUtcDay(date)
  const windowEnd = endOfPreviousUtcDay(date)
  const dayKey = windowStart.toISOString().slice(0, 10)

  if (!isPolicyEffectiveFor(windowEnd)) {
    console.info("[commission-engine] daily_override_skipped", {
      day: dayKey,
      reason: "before_policy_effective",
      effectiveFrom: getPolicyEffectiveAt().toISOString(),
    })
    return []
  }

  const profitDocs = await TeamDailyProfit.find({
    profitDate: { $gte: windowStart, $lte: windowEnd },
  })
    .select({ memberId: 1, profitAmount: 1 })
    .lean()

  if (profitDocs.length === 0) {
    return []
  }

  const memberIds = Array.from(
    new Set(
      profitDocs
        .map((doc) => toObjectIdString(doc.memberId as any))
        .filter((value): value is string => Boolean(value)),
    ),
  )

  const memberObjectIds = memberIds
    .map((id) => toObjectId(id))
    .filter((value): value is mongoose.Types.ObjectId => value !== null)

  const members = memberObjectIds.length
    ? await User.find({ _id: { $in: memberObjectIds } })
        .select({ _id: 1, referredBy: 1, name: 1 })
        .lean()
    : []

  const memberMap = new Map<string, { referredBy: string | null; name?: string | null }>()
  const sponsorIds = new Set<string>()

  for (const member of members) {
    const id = toObjectIdString(member._id as any)
    const referredBy = toObjectIdString(member.referredBy as any)
    if (!id) {
      continue
    }

    memberMap.set(id, { referredBy, name: (member as any).name ?? null })
    if (referredBy) {
      sponsorIds.add(referredBy)
    }
  }

  const sponsorObjectIds = Array.from(sponsorIds)
    .map((id) => toObjectId(id))
    .filter((value): value is mongoose.Types.ObjectId => value !== null)

  const sponsors = sponsorObjectIds.length
    ? await User.find({ _id: { $in: sponsorObjectIds } })
        .select({ _id: 1, referredBy: 1 })
        .lean()
    : []

  const sponsorMap = new Map<string, string | null>()
  for (const sponsor of sponsors) {
    const id = toObjectIdString(sponsor._id as any)
    if (!id) {
      continue
    }

    const sponsorSponsorId = toObjectIdString(sponsor.referredBy as any)
    sponsorMap.set(id, sponsorSponsorId)
  }

  const outcomes: DailyOverrideResult[] = []
  let skippedMissingUpline = 0

  for (const doc of profitDocs) {
    const memberId = toObjectIdString(doc.memberId as any)
    if (!memberId) continue

    const baseProfitRaw = Number(doc.profitAmount ?? 0)
    const baseProfit = roundPlatform(baseProfitRaw)
    if (!Number.isFinite(baseProfit) || baseProfit <= 0) {
      continue
    }

    const memberInfo = memberMap.get(memberId)
    if (!memberInfo) {
      skippedMissingUpline += 2
      continue
    }

    const leaderId = memberInfo.referredBy ?? null
    const memberName = memberInfo?.name ?? null
    const leaderLeaderId = leaderId ? sponsorMap.get(leaderId) ?? null : null

    const leaderOutcome = await creditDailyOverride({
      recipientId: leaderId,
      level: 1,
      baseAmount: baseProfit,
      memberId,
      memberName,
      dayKey,
      postedAt: windowEnd,
    })

    if (leaderOutcome) {
      outcomes.push(leaderOutcome)
    } else if (!leaderId) {
      skippedMissingUpline += 1
    }

    const leader2Outcome = await creditDailyOverride({
      recipientId: leaderLeaderId,
      level: 2,
      baseAmount: baseProfit,
      memberId,
      memberName,
      dayKey,
      postedAt: windowEnd,
    })

    if (leader2Outcome) {
      outcomes.push(leader2Outcome)
    } else if (!leaderLeaderId) {
      skippedMissingUpline += 1
    }
  }

  if (skippedMissingUpline > 0) {
    console.info("[commission-engine] daily_override_skipped_upline", {
      day: dayKey,
      skippedMissingUpline,
    })
  }

  return outcomes
}

export async function runDailyCommissionEngine(date: Date = new Date()) {
  return payDailyTeamProfit(date)
}

export async function runMonthlyBonusCycle() {
  return []
}
