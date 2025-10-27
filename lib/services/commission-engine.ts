import mongoose from "mongoose"

import dbConnect from "@/lib/mongodb"
import Balance from "@/models/Balance"
import TeamDailyProfit from "@/models/TeamDailyProfit"
import Transaction from "@/models/Transaction"
import User from "@/models/User"

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

function roundTo(amount: number, decimals: number): number {
  if (!Number.isFinite(amount)) {
    return 0
  }

  const factor = 10 ** decimals
  return Math.round(amount * factor) / factor
}

function toObjectIdString(value: mongoose.Types.ObjectId | string): string {
  return typeof value === "string" ? value : value.toString()
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

  const amount = roundTo(baseAmount * 0.01, 4)
  if (amount <= 0) {
    return null
  }

  const uniqueKey = `DOV:${dayKey}:${memberId}:L${level}`

  const existing = await Transaction.findOne({
    userId: recipientId,
    "meta.uniqueKey": uniqueKey,
  })

  if (existing) {
    return null
  }

  await Balance.findOneAndUpdate(
    { userId: recipientId },
    {
      $inc: {
        current: amount,
        totalBalance: amount,
        totalEarning: amount,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  await Transaction.create({
    userId: recipientId,
    type: "bonus",
    amount,
    status: "approved",
    meta: {
      source: "daily_override",
      level,
      ratePct: 1,
      baseProfit: roundTo(baseAmount, 4),
      memberId,
      memberName: memberName ?? null,
      uniqueKey,
      day: dayKey,
    },
    createdAt: postedAt,
    updatedAt: postedAt,
  } as any)

  return { userId: recipientId, level, amount, memberId }
}

export async function payDailyTeamProfit(date: Date = new Date()): Promise<DailyOverrideResult[]> {
  await dbConnect()

  const windowStart = startOfPreviousUtcDay(date)
  const windowEnd = endOfPreviousUtcDay(date)
  const dayKey = windowStart.toISOString().slice(0, 10)

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
        .map((doc) => (doc.memberId ? toObjectIdString(doc.memberId as any) : null))
        .filter((value): value is string => Boolean(value)),
    ),
  )

  const members = memberIds.length
    ? await User.find({ _id: { $in: memberIds } })
        .select({ _id: 1, referredBy: 1, name: 1 })
        .lean()
    : []

  const memberMap = new Map<string, { referredBy: string | null; name?: string | null }>()
  const sponsorIds = new Set<string>()

  for (const member of members) {
    const id = toObjectIdString(member._id as any)
    const referredBy = member.referredBy ? toObjectIdString(member.referredBy as any) : null
    memberMap.set(id, { referredBy, name: (member as any).name ?? null })
    if (referredBy) {
      sponsorIds.add(referredBy)
    }
  }

  const sponsors = sponsorIds.size
    ? await User.find({ _id: { $in: Array.from(sponsorIds) } })
        .select({ _id: 1, referredBy: 1 })
        .lean()
    : []

  const sponsorMap = new Map<string, string | null>()
  for (const sponsor of sponsors) {
    const id = toObjectIdString(sponsor._id as any)
    const sponsorSponsorId = sponsor.referredBy ? toObjectIdString(sponsor.referredBy as any) : null
    sponsorMap.set(id, sponsorSponsorId)
  }

  const outcomes: DailyOverrideResult[] = []

  for (const doc of profitDocs) {
    const memberId = doc.memberId ? toObjectIdString(doc.memberId as any) : null
    if (!memberId) continue

    const baseProfit = Number(doc.profitAmount ?? 0)
    if (!Number.isFinite(baseProfit) || baseProfit <= 0) {
      continue
    }

    const memberInfo = memberMap.get(memberId)
    const leaderId = memberInfo?.referredBy ?? null
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
    }
  }

  return outcomes
}

export async function runDailyCommissionEngine(date: Date = new Date()) {
  return payDailyTeamProfit(date)
}

export async function runMonthlyBonusCycle() {
  return []
}
