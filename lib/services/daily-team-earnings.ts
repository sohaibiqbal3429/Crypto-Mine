import mongoose from "mongoose"

import dbConnect from "@/lib/mongodb"
import Balance from "@/models/Balance"
import TeamDailyProfit from "@/models/TeamDailyProfit"
import Transaction from "@/models/Transaction"
import User from "@/models/User"
import { emitAuditLog } from "@/lib/observability/audit"

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

function round2(amount: number): number {
  const f = 100
  return Math.round(amount * f) / f
}

// Previous local day window for Asia/Karachi (UTC+05:00), with UTC timestamps
function getPreviousPktDayRange(reference: Date) {
  const OFFSET_MS = 5 * 60 * 60 * 1000
  const local = new Date(reference.getTime() + OFFSET_MS)

  // local date components
  const y = local.getUTCFullYear()
  const m = local.getUTCMonth()
  const d = local.getUTCDate()

  const startLocal = new Date(Date.UTC(y, m, d - 1, 0, 0, 0, 0))
  const endLocal = new Date(Date.UTC(y, m, d - 1, 23, 59, 59, 999))

  // convert back to UTC instants
  const start = new Date(startLocal.getTime() - OFFSET_MS)
  const end = new Date(endLocal.getTime() - OFFSET_MS)

  const dayKey = `${startLocal.getUTCFullYear()}-${String(startLocal.getUTCMonth() + 1).padStart(2, "0")}-${String(
    startLocal.getUTCDate(),
  ).padStart(2, "0")}`

  return { start, end, dayKey }
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

  const created = await Transaction.create({
    userId: sponsorObjectId,
    type: "teamReward",
    amount: reward,
    status: "approved",
    claimable: true,
    meta: { ...meta, uniqueKey: uniqueEventId },
  } as any)

  return created?._id ? created._id.toString() : ""
}

export interface DailyTeamEarningsSummary {
  day: string
  postedCount: number
  uniqueReceivers: number
  totalReward: number
}

export async function runDailyTeamEarnings(now = new Date()): Promise<DailyTeamEarningsSummary> {
  await dbConnect()

  // Settle previous PKT day (00:00 PKT schedule)
  const { start, end, dayKey } = getPreviousPktDayRange(now)
  const profits = await aggregateProfits(start, end)

  const userCache = new Map<string, CachedUser | null>()
  let postedCount = 0
  let totalReward = 0
  const receivers = new Set<string>()

  for (const [memberId, aggregated] of profits.entries()) {
    const baseProfitRaw = Number(aggregated.sumProfit ?? 0)
    if (!Number.isFinite(baseProfitRaw) || baseProfitRaw <= 0) {
      continue
    }

    // 1% per level, 2-decimal, round half-up
    const reward = round2(baseProfitRaw * 0.01)
    if (reward <= 0) {
      continue
    }

    const member = await loadUserCached(userCache, memberId)
    if (!member) {
      continue
    }

    if (member.referredBy) {
      const sponsorA = await loadUserCached(userCache, member.referredBy)
      let l1TxnId: string | null = null
      let l2TxnId: string | null = null
      let l1Id: string | null = null
      let l2Id: string | null = null

      if (sponsorA) {
        l1Id = sponsorA.id
        const createdId = await creditTeamReward({
          sponsor: sponsorA,
          team: "A",
          dayKey,
          baseProfit: baseProfitRaw,
          reward,
          member,
          memberActive: aggregated.wasActive,
        })
        if (createdId) {
          l1TxnId = createdId
          postedCount += 1
          totalReward += reward
          receivers.add(sponsorA.id)
        }

        if (sponsorA.referredBy) {
          const sponsorB = await loadUserCached(userCache, sponsorA.referredBy)
          if (sponsorB) {
            l2Id = sponsorB.id
            const createdBId = await creditTeamReward({
              sponsor: sponsorB,
              team: "B",
              dayKey,
              baseProfit: baseProfitRaw,
              reward,
              member,
              memberActive: aggregated.wasActive,
            })
            if (createdBId) {
              l2TxnId = createdBId
              postedCount += 1
              totalReward += reward
              receivers.add(sponsorB.id)
            }
          }
        }
      }

      // Emit an audit log for the combined payout per member per day
      emitAuditLog("daily_referral_earnings", {
        date: dayKey,
        userId: member.id,
        earningBase: round2(baseProfitRaw),
        L1Id: l1Id,
        L1Amount: l1TxnId ? reward : 0,
        L2Id: l2Id,
        L2Amount: l2TxnId ? reward : 0,
        txnIds: [l1TxnId, l2TxnId].filter(Boolean),
      })
    }
  }

  const summary: DailyTeamEarningsSummary = {
    day: dayKey,
    postedCount,
    uniqueReceivers: receivers.size,
    totalReward: round2(totalReward),
  }

  console.info("[daily-team-earnings] summary", summary)

  return summary
}
