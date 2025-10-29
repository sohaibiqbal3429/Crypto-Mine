import mongoose from "mongoose"

import dbConnect from "@/lib/mongodb"
import Balance from "@/models/Balance"
import TeamDailyProfit from "@/models/TeamDailyProfit"
import Transaction from "@/models/Transaction"
import User from "@/models/User"

const TEAM_DEPTH: Record<"A" | "B", number> = { A: 1, B: 2 }

function ensureObjectId(value: mongoose.Types.ObjectId | string): mongoose.Types.ObjectId {
  if (value instanceof mongoose.Types.ObjectId) {
    return value
  }

  if (typeof value === "string" && mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value)
  }

  throw new Error("Invalid ObjectId value")
}

function toStringId(value: mongoose.Types.ObjectId | string): string {
  return typeof value === "string" ? value : value.toString()
}

function normalizeId(value: mongoose.Types.ObjectId | string | Record<string, unknown> | null | undefined): string | null {
  if (!value) {
    return null
  }

  if (value instanceof mongoose.Types.ObjectId) {
    return value.toHexString()
  }

  if (typeof value === "string") {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new Error("Invalid ObjectId value")
    }
    return value
  }

  if (typeof (value as { toHexString?: () => string }).toHexString === "function") {
    return (value as { toHexString: () => string }).toHexString()
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    if (record._id) {
      return normalizeId(record._id as mongoose.Types.ObjectId | string | Record<string, unknown>)
    }
    if (record.buffer && typeof record.buffer === "object") {
      const raw = record.buffer as Record<string, unknown>
      const bytes = Object.keys(raw)
        .sort((a, b) => Number(a) - Number(b))
        .map((key) => Number(raw[key] ?? 0))
      if (bytes.length === 12) {
        return Buffer.from(bytes).toString("hex")
      }
    }
  }

  try {
    return toStringId(ensureObjectId(value as unknown as mongoose.Types.ObjectId | string))
  } catch (error) {
    throw new Error("Invalid ObjectId value")
  }
}

function roundDown(amount: number, decimals = 4): number {
  if (!Number.isFinite(amount)) {
    return 0
  }

  const factor = 10 ** decimals
  if (amount <= 0) {
    return Math.ceil(amount * factor) / factor
  }

  return Math.floor(amount * factor) / factor
}

function getPreviousUtcDayRange(reference: Date) {
  const start = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate() - 1, 0, 0, 0, 0),
  )
  const end = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate() - 1, 23, 59, 59, 999),
  )

  return { start, end, dayKey: start.toISOString().slice(0, 10) }
}

type AggregatedProfit = {
  sumProfit: number
  wasActive: boolean
}

type CachedUser = {
  id: string
  referredBy: string | null
  name?: string
}

/**
 * In several places we need to query by either string or ObjectId user identifiers.
 * This helper ensures a consistent candidate list for idempotency lookups.
 */
function buildUserIdCandidates(userId: string): (mongoose.Types.ObjectId | string)[] {
  const candidates: (mongoose.Types.ObjectId | string)[] = [userId]
  if (mongoose.Types.ObjectId.isValid(userId)) {
    candidates.push(ensureObjectId(userId))
  }
  return candidates
}

async function loadUserCached(
  cache: Map<string, CachedUser | null>,
  userId: string,
): Promise<CachedUser | null> {
  if (cache.has(userId)) {
    return cache.get(userId) ?? null
  }

  const doc = await User.findOne(
    { _id: { $in: buildUserIdCandidates(userId) } },
    { _id: 1, referredBy: 1, name: 1 },
  )
  if (!doc?._id) {
    console.info("[daily-team-earnings] loadUserCached_not_found", { userId })
    cache.set(userId, null)
    return null
  }

  const normalizedId = normalizeId(doc._id as mongoose.Types.ObjectId | string)!
  const referredBy = normalizeId((doc as { referredBy?: mongoose.Types.ObjectId | string | null }).referredBy)
  const cached: CachedUser = {
    id: normalizedId,
    referredBy,
    name: typeof (doc as { name?: unknown }).name === "string" ? ((doc as { name?: string }).name as string) : undefined,
  }

  cache.set(userId, cached)
  return cached
}

async function aggregateProfits(start: Date, end: Date): Promise<Map<string, AggregatedProfit>> {
  const docs = await TeamDailyProfit.find({
    profitDate: { $gte: start, $lte: end },
  })
    .select({ memberId: 1, profitAmount: 1, activeOnDate: 1 })
    .lean()

  const map = new Map<string, AggregatedProfit>()

  for (const doc of docs) {
    const memberIdRaw = (doc as { memberId?: mongoose.Types.ObjectId | string }).memberId
    const memberId = normalizeId(memberIdRaw)
    if (!memberId) {
      continue
    }

    const profitAmount = Number((doc as { profitAmount?: unknown }).profitAmount ?? 0)
    const activeOnDate = Boolean((doc as { activeOnDate?: unknown }).activeOnDate)

    const previous = map.get(memberId) ?? { sumProfit: 0, wasActive: false }
    map.set(memberId, {
      sumProfit: previous.sumProfit + profitAmount,
      wasActive: previous.wasActive || activeOnDate,
    })
  }

  return map
}

async function hasExistingEvent(userId: string, uniqueEventId: string) {
  const existing = await Transaction.findOne(
    {
      "meta.uniqueEventId": uniqueEventId,
    },
    { _id: 1, userId: 1 },
  )

  if (!existing) {
    return false
  }

  const storedUserId = normalizeId((existing as { userId?: mongoose.Types.ObjectId | string }).userId)
  if (!storedUserId) {
    return true
  }

  const normalizedUserId = normalizeId(userId)
  return storedUserId === normalizedUserId
}

async function creditTeamReward({
  sponsor,
  team,
  dayKey,
  baseProfit,
  reward,
  member,
  memberActive,
}: {
  sponsor: CachedUser
  team: "A" | "B"
  dayKey: string
  baseProfit: number
  reward: number
  member: CachedUser
  memberActive: boolean
}): Promise<boolean> {
  const uniqueEventId = `DTE:${dayKey}:${member.id}:${sponsor.id}:${team}`
  const exists = await hasExistingEvent(sponsor.id, uniqueEventId)
  if (exists) {
    console.info("[daily-team-earnings] duplicate_prevented", {
      userId: sponsor.id,
      uniqueEventId,
    })
    return false
  }

  const sponsorObjectId = ensureObjectId(sponsor.id)

  await Balance.updateOne(
    { userId: sponsorObjectId },
    {
      $inc: { teamRewardsAvailable: reward },
      $setOnInsert: { userId: sponsorObjectId },
    },
    { upsert: true },
  )

  const meta = {
    source: "daily_team_earning" as const,
    team,
    day: dayKey,
    memberId: member.id,
    memberName: member.name,
    fromUserId: member.id,
    fromUserName: member.name,
    ratePct: 1,
    baseProfit,
    baseProfitRounded: baseProfit,
    teamProfit: baseProfit,
    teamDepth: TEAM_DEPTH[team],
    generation: TEAM_DEPTH[team],
    memberActive,
    uniqueEventId,
  }

  await Transaction.create({
    userId: sponsorObjectId,
    type: "teamReward",
    amount: reward,
    status: "approved",
    claimable: true,
    meta: { ...meta, uniqueKey: uniqueEventId },
  } as any)

  return true
}

export interface DailyTeamEarningsSummary {
  day: string
  postedCount: number
  uniqueReceivers: number
  totalReward: number
}

export async function runDailyTeamEarnings(now = new Date()): Promise<DailyTeamEarningsSummary> {
  await dbConnect()

  const { start, end, dayKey } = getPreviousUtcDayRange(now)
  const profits = await aggregateProfits(start, end)

  const userCache = new Map<string, CachedUser | null>()
  let postedCount = 0
  let totalReward = 0
  const receivers = new Set<string>()

  for (const [memberId, aggregated] of profits.entries()) {
    const baseProfit = roundDown(aggregated.sumProfit, 4)
    if (baseProfit <= 0) {
      continue
    }

    const reward = roundDown(baseProfit * 0.01, 4)
    if (reward <= 0) {
      continue
    }

    const member = await loadUserCached(userCache, memberId)
    if (!member) {
      continue
    }

    if (member.referredBy) {
      const sponsorA = await loadUserCached(userCache, member.referredBy)
      if (sponsorA) {
        const created = await creditTeamReward({
          sponsor: sponsorA,
          team: "A",
          dayKey,
          baseProfit,
          reward,
          member,
          memberActive: aggregated.wasActive,
        })

        if (created) {
          postedCount += 1
          totalReward += reward
          receivers.add(sponsorA.id)
        }

        if (aggregated.wasActive && sponsorA.referredBy) {
          const sponsorB = await loadUserCached(userCache, sponsorA.referredBy)
          if (sponsorB) {
            const createdB = await creditTeamReward({
              sponsor: sponsorB,
              team: "B",
              dayKey,
              baseProfit,
              reward,
              member,
              memberActive: aggregated.wasActive,
            })

            if (createdB) {
              postedCount += 1
              totalReward += reward
              receivers.add(sponsorB.id)
            }
          }
        }
      }
    }
  }

  const summary: DailyTeamEarningsSummary = {
    day: dayKey,
    postedCount,
    uniqueReceivers: receivers.size,
    totalReward: roundDown(totalReward, 4),
  }

  console.info("[daily-team-earnings] summary", summary)

  return summary
}
