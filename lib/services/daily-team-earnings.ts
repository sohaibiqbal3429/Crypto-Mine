import mongoose from "mongoose"

import dbConnect from "@/lib/mongodb"
import Balance from "@/models/Balance"
import TeamDailyProfit from "@/models/TeamDailyProfit"
import Transaction from "@/models/Transaction"
import User from "@/models/User"
import LedgerEntry from "@/models/LedgerEntry"
import Payout from "@/models/Payout"
import { emitAuditLog } from "@/lib/observability/audit"
import { getTeamDailyProfitPercent } from "@/lib/services/settings"

const TEAM_DEPTH: Record<"A" | "B", number> = { A: 1, B: 2 }

function ensureObjectId(value: mongoose.Types.ObjectId | string): mongoose.Types.ObjectId {
  if (value instanceof mongoose.Types.ObjectId) return value
  if (typeof value === "string" && mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value)
  }
  throw new Error("Invalid ObjectId value")
}

function toStringId(value: mongoose.Types.ObjectId | string): string {
  return typeof value === "string" ? value : value.toString()
}

function normalizeId(
  value: mongoose.Types.ObjectId | string | Record<string, unknown> | null | undefined,
): string | null {
  if (!value) return null
  if (value instanceof mongoose.Types.ObjectId) return value.toHexString()
  if (typeof value === "string") {
    if (!mongoose.Types.ObjectId.isValid(value)) throw new Error("Invalid ObjectId value")
    return value
  }
  if (typeof (value as { toHexString?: () => string }).toHexString === "function") {
    return (value as { toHexString: () => string }).toHexString()
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    if (record._id) return normalizeId(record._id as any)
    if (record.buffer && typeof record.buffer === "object") {
      const raw = record.buffer as Record<string, unknown>
      const bytes = Object.keys(raw).sort((a, b) => Number(a) - Number(b)).map((k) => Number(raw[k] ?? 0))
      if (bytes.length === 12) return Buffer.from(bytes).toString("hex")
    }
  }
  try {
    return toStringId(ensureObjectId(value as any))
  } catch {
    throw new Error("Invalid ObjectId value")
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const code = (error as { code?: unknown }).code
  return code === 11000
}

// 2-decimal (half-up)
function round2(amount: number): number {
  const f = 100
  return Math.round(amount * f) / f
}

// Compute the *previous* PKT calendar day window using UTC timestamps.
// This is intended to run at 00:00 PKT.
function getPreviousPktDayRange(reference: Date) {
  const OFFSET_MS = 5 * 60 * 60 * 1000 // UTC+05:00, PKT
  const local = new Date(reference.getTime() + OFFSET_MS)

  const y = local.getUTCFullYear()
  const m = local.getUTCMonth()
  const d = local.getUTCDate()

  const startLocal = new Date(Date.UTC(y, m, d - 1, 0, 0, 0, 0))
  const endLocal = new Date(Date.UTC(y, m, d - 1, 23, 59, 59, 999))

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

function buildUserIdCandidates(userId: string): (mongoose.Types.ObjectId | string)[] {
  const candidates: (mongoose.Types.ObjectId | string)[] = [userId]
  if (mongoose.Types.ObjectId.isValid(userId)) candidates.push(ensureObjectId(userId))
  return candidates
}

async function loadUserCached(
  cache: Map<string, CachedUser | null>,
  userId: string,
): Promise<CachedUser | null> {
  if (cache.has(userId)) return cache.get(userId) ?? null

  const doc = await User.findOne(
    { _id: { $in: buildUserIdCandidates(userId) } },
    { _id: 1, referredBy: 1, name: 1 },
  )
  if (!doc?._id) {
    console.info("[daily-team-earnings] loadUserCached_not_found", { userId })
    cache.set(userId, null)
    return null
  }

  const normalizedId = normalizeId(doc._id as any)!
  const referredBy = normalizeId((doc as { referredBy?: mongoose.Types.ObjectId | string | null }).referredBy)
  const cached: CachedUser = {
    id: normalizedId,
    referredBy,
    name: typeof (doc as { name?: unknown }).name === "string" ? ((doc as { name?: string }).name as string) : undefined,
  }

  cache.set(userId, cached)
  return cached
}

/**
 * Aggregate a user's *daily earnings base*:
 *  - Include: mining/trading/profit income
 *  - Exclude: deposits, bonuses, airdrops, and anything else
 *
 * We trust `TeamDailyProfit` as the canonical per-member profit table for the day,
 * and *optionally* add direct `Transaction` rows of type 'earn' that are clearly
 * marked as profit sources.
 */
async function aggregateProfits(start: Date, end: Date): Promise<Map<string, AggregatedProfit>> {
  const map = new Map<string, AggregatedProfit>()

  // 1) Canonical: roll up TeamDailyProfit for the window (already net profit)
  const profitDocs = await TeamDailyProfit.find({
    profitDate: { $gte: start, $lte: end },
  })
    .select({ memberId: 1, profitAmount: 1, activeOnDate: 1 })
    .lean()

  for (const doc of profitDocs) {
    const memberId = normalizeId((doc as { memberId?: mongoose.Types.ObjectId | string }).memberId)
    if (!memberId) continue
    const amount = Number((doc as { profitAmount?: unknown }).profitAmount ?? 0)
    const activeOnDate = Boolean((doc as { activeOnDate?: unknown }).activeOnDate)

    const prev = map.get(memberId) ?? { sumProfit: 0, wasActive: false }
    map.set(memberId, { sumProfit: prev.sumProfit + amount, wasActive: prev.wasActive || activeOnDate })
  }

  // 2) (Optional) Any other explicit profit EARN tx (strict allow-list on meta.source)
  //    This keeps us aligned with: "Daily earnings = net profit or mining/trading income only
  //    (exclude deposits, bonuses, airdrops)."
  const ALLOWED_PROFIT_SOURCES = [
    "mining",
    "trading",
    "profit",
    "roi",
    "daily_mining_profit",
  ] as const

  const earnTx = await Transaction.find({
    type: "earn",
    status: "approved",
    createdAt: { $gte: start, $lte: end },
    $or: [
      { "meta.source": { $in: ALLOWED_PROFIT_SOURCES } },
      // Some systems store category/kind instead of source; keep this conservative.
      { "meta.category": { $in: ["profit", "roi", "trading", "mining"] } },
    ],
  })
    .select({ userId: 1, amount: 1 })
    .lean()

  for (const tx of earnTx) {
    const uid = normalizeId((tx as { userId?: mongoose.Types.ObjectId | string }).userId)
    if (!uid) continue
    const amt = Number((tx as { amount?: unknown }).amount ?? 0)
    if (!(amt > 0)) continue

    const prev = map.get(uid) ?? { sumProfit: 0, wasActive: false }
    map.set(uid, { sumProfit: prev.sumProfit + amt, wasActive: prev.wasActive })
  }

  return map
}

async function hasExistingEvent(userId: string, uniqueEventId: string) {
  const existing = await Transaction.findOne(
    { "meta.uniqueEventId": uniqueEventId },
    { _id: 1, userId: 1 },
  )
  if (!existing) return false

  const storedUserId = normalizeId((existing as { userId?: mongoose.Types.ObjectId | string }).userId)
  if (!storedUserId) return true
  const normalizedUserId = normalizeId(userId)
  return storedUserId === normalizedUserId
}

async function creditTeamReward({
  sponsor,
  team,
  dayKey,
  payoutDate,
  baseProfit,
  reward,
  member,
  memberActive,
  ratePct,
}: {
  sponsor: CachedUser
  team: "A" | "B"
  dayKey: string
  payoutDate: Date
  baseProfit: number
  reward: number
  member: CachedUser
  memberActive: boolean
  ratePct: number
}): Promise<string | null> {
  const uniqueEventId = `DTE:${dayKey}:${member.id}:${sponsor.id}:${team}`
  const exists = await hasExistingEvent(sponsor.id, uniqueEventId)
  if (exists) {
    console.info("[daily-team-earnings] duplicate_prevented", { userId: sponsor.id, uniqueEventId })
    return null
  }

  const sponsorIdCandidates = buildUserIdCandidates(sponsor.id)
  const sponsorPrimaryId = sponsorIdCandidates[0]

  await Balance.updateOne(
    { userId: { $in: sponsorIdCandidates } },
    { $inc: { teamRewardsAvailable: reward }, $setOnInsert: { userId: sponsorPrimaryId } },
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
    ratePct,
    baseProfit: baseProfit,
    baseProfitRounded: round2(baseProfit),
    teamProfit: baseProfit,
    teamDepth: TEAM_DEPTH[team],
    generation: TEAM_DEPTH[team],
    memberActive,
    uniqueEventId,
  }

  let payoutId: string | null = null
  const payoutPayload = {
    userId: ensureObjectId(sponsor.id),
    type: "daily_team_earning" as const,
    sourceId: ensureObjectId(member.id),
    amount: reward,
    status: "completed" as const,
    date: payoutDate,
    uniqueKey: uniqueEventId,
    meta,
  }

  try {
    const createdPayout = await Payout.create(payoutPayload)
    payoutId = createdPayout?._id ? createdPayout._id.toString() : null
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error
    }
    const existingPayout = await Payout.findOne({ uniqueKey: uniqueEventId }, { _id: 1 }).lean()
    payoutId = existingPayout?._id ? existingPayout._id.toString() : null
  }

  const created = await Transaction.create({
    userId: sponsorPrimaryId,
    type: "teamReward",
    amount: reward,
    status: "approved",
    claimable: true,
    meta: { ...meta, uniqueKey: uniqueEventId, payoutId },
  } as any)

  const ledgerKey = `daily_team_commission:${dayKey}:${team}:${member.id}:${sponsor.id}`

  try {
    await LedgerEntry.create({
      userId: ensureObjectId(sponsor.id),
      beneficiaryId: ensureObjectId(sponsor.id),
      sourceUserId: ensureObjectId(member.id),
      type: "daily_team_commission",
      amount: reward,
      rate: ratePct,
      meta: {
        uniqueKey: ledgerKey,
        date: dayKey,
        team,
        memberId: member.id,
        memberName: member.name,
        baseProfit: round2(baseProfit),
        transactionId: created?._id?.toString() ?? null,
        payoutId,
      },
    })
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error
    }
  }

  return created?._id ? created._id.toString() : null
}

export interface DailyTeamEarningsSummary {
  day: string
  postedCount: number
  uniqueReceivers: number
  totalReward: number
}

/**
 * Two-level daily referral earnings:
 *  - From each user's *daily earnings base*: pay 1% to L1 and 1% to L2
 *  - If a level doesn't exist, it's simply skipped
 *  - Uses 2-decimals, half-up
 *  - Intended to run daily at 00:00 Asia/Karachi (PKT)
 *  - Emits a single audit log per member/day with: {date, userId, earningBase, L1Id, L1Amount, L2Id, L2Amount, txnIds}
 */
export async function runDailyTeamEarnings(now = new Date()): Promise<DailyTeamEarningsSummary> {
  await dbConnect()

  // Settle the previous PKT day (scheduler should trigger at 00:00 PKT)
  const { start, end, dayKey } = getPreviousPktDayRange(now)
  const profits = await aggregateProfits(start, end)
  // Admin-configurable percent; default to 1% if not set
  const overridePct = await getTeamDailyProfitPercent().catch(() => null)
  const ratePct = typeof overridePct === "number" && Number.isFinite(overridePct) ? overridePct : 1

  const userCache = new Map<string, CachedUser | null>()
  let postedCount = 0
  let totalReward = 0
  const receivers = new Set<string>()

  for (const [memberId, aggregated] of profits.entries()) {
    const baseProfitRaw = Number(aggregated.sumProfit ?? 0)
    if (!(baseProfitRaw > 0)) continue

    // Configurable percent per level, two-decimal, half-up
    const reward = round2(baseProfitRaw * (ratePct / 100))
    if (!(reward > 0)) continue

    const member = await loadUserCached(userCache, memberId)
    if (!member) continue

    if (member.referredBy) {
      const sponsorA = await loadUserCached(userCache, member.referredBy)

      let l1TxnId: string | null = null
      let l2TxnId: string | null = null
      let l1Id: string | null = null
      let l2Id: string | null = null

      if (sponsorA) {
        l1Id = sponsorA.id
        const createdA = await creditTeamReward({
          sponsor: sponsorA,
          team: "A",
          dayKey,
          payoutDate: end,
          baseProfit: baseProfitRaw,
          reward,
          member,
          memberActive: aggregated.wasActive,
          ratePct: ratePct,
        })
        if (createdA) {
          l1TxnId = createdA
          postedCount += 1
          totalReward += reward
          receivers.add(sponsorA.id)
        }

        if (sponsorA.referredBy) {
          const sponsorB = await loadUserCached(userCache, sponsorA.referredBy)
          if (sponsorB) {
            l2Id = sponsorB.id
            const createdB = await creditTeamReward({
              sponsor: sponsorB,
              team: "B",
              dayKey,
              payoutDate: end,
              baseProfit: baseProfitRaw,
              reward,
              member,
              memberActive: aggregated.wasActive,
              ratePct: ratePct,
            })
            if (createdB) {
              l2TxnId = createdB
              postedCount += 1
              totalReward += reward
              receivers.add(sponsorB.id)
            }
          }
        }
      }

      // Required audit log (single line per member/day)
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
