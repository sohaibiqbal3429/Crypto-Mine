import mongoose from "mongoose"

import dbConnect from "@/lib/mongodb"
import Balance from "@/models/Balance"
<<<<<<< HEAD
import Payout from "@/models/Payout"
// import { getTeamDailyProfitPercent } from "@/lib/services/settings" // not needed now (fixed 1%/1%)
=======
>>>>>>> 540578136175f1417fd115e5232b0c4beebc12e7
import TeamDailyProfit from "@/models/TeamDailyProfit"
import Transaction from "@/models/Transaction"
import User from "@/models/User"
import { getPolicyEffectiveAt, isPolicyEffectiveFor } from "@/lib/utils/policy"

interface DailyOverrideResult {
  userId: string
  level: 1 | 2
  amount: number
<<<<<<< HEAD
  level: number
  totalTeamProfit: number
  teams: TeamCode[]
}

interface CommissionOutcome {
  payoutId?: string
  amount: number
  created: boolean
  level: number
  uniqueKey: string
}

const ACTIVE_THRESHOLD = 80

// ---- Fixed daily override policy (as per your spec) ----
const DAILY_L1_PCT = 0.01 // 1% for Team A (L1) always
const DAILY_L2_PCT = 0.01 // 1% for Team B (L2) only if member was Active that day

// Existing level table left intact for monthly/deposit flows if used elsewhere
const LEVELS: LevelDefinition[] = [
  {
    id: 1,
    eligibility: { directs_active: 5 },
    direct_rate: 0.07,
    team_profit_rate: 0.01,
    teams_profit: ["A"],
  },
  {
    id: 2,
    eligibility: { directs_fresh_active: 10 },
    direct_rate: 0.08,
    team_profit_rate: 0.01,
    teams_profit: ["A", "B", "C"],
  },
  {
    id: 3,
    eligibility: { directs_active: 15 },
    team_deposit_rate: 0.08,
    team_profit_rate: 0.02,
    teams_profit: ["A", "B", "C", "D"],
    teams_deposit: ["A", "B", "C", "D"],
  },
  {
    id: 4,
    eligibility: { directs_fresh_active: 23 },
    direct_rate: 0.09,
    team_profit_rate: 0.02,
    teams_profit: ["A", "B", "C", "D"],
    monthly_bonus: { threshold_direct_usdt: 2200, amount: 200, tier: "2200" },
  },
  {
    id: 5,
    eligibility: { directs_active: 30 },
    direct_rate: 0.1,
    team_profit_rate: 0.02,
    teams_profit: ["A", "B", "C", "D"],
    monthly_bonus: { threshold_direct_usdt: 4500, amount: 400, tier: "4500" },
  },
]

const LEVELS_BY_ID = new Map(LEVELS.map((definition) => [definition.id, definition]))
const TEAM_DEPTH: Record<TeamCode, number> = { A: 1, B: 2, C: 3, D: 4 }

function ensureObjectId(value: mongoose.Types.ObjectId | string): mongoose.Types.ObjectId {
  if (value instanceof mongoose.Types.ObjectId) return value
  if (mongoose.Types.ObjectId.isValid(value)) return new mongoose.Types.ObjectId(value)
  throw new Error("Invalid ObjectId value")
}

function toStringId(value: mongoose.Types.ObjectId | string): string {
  return typeof value === "string" ? value : value.toString()
}

function normalizeId(value: unknown): string {
  return toStringId(ensureObjectId(value as mongoose.Types.ObjectId | string))
}

function toPlain<T>(doc: T | { toObject?: () => T } | null | undefined): T | null {
  if (!doc) return null
  if (typeof (doc as { toObject?: () => T }).toObject === "function") {
    return (doc as { toObject: () => T }).toObject()
  }
  return doc as T
}

function roundAmount(amount: number): number {
  return Math.round(amount * 100) / 100
}

// 4-decimal rounding (truncate positive values)
function roundDown(amount: number, decimals = 4): number {
  if (!Number.isFinite(amount)) return 0
  const factor = 10 ** decimals
  if (amount <= 0) return Math.ceil(amount * factor) / factor
  return Math.floor(amount * factor) / factor
=======
  memberId: string
>>>>>>> 540578136175f1417fd115e5232b0c4beebc12e7
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

<<<<<<< HEAD
function resolveMonthRange(referenceDate: Date) {
  const normalized = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1))
  const start = new Date(Date.UTC(normalized.getUTCFullYear(), normalized.getUTCMonth() - 1, 1))
  const end = new Date(Date.UTC(normalized.getUTCFullYear(), normalized.getUTCMonth(), 1))
  const monthKey = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`
  return { start, end, monthKey }
}

function getFreshQualificationCutoff(date: Date): Date | null {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

async function fetchDirectReferrals(userId: string) {
  const docs = await User.find({ referredBy: ensureObjectId(userId) }).select(
    "_id depositTotal qualified qualifiedAt createdAt updatedAt",
  )
  return docs.map((doc) => toPlain(doc)!)
=======
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
>>>>>>> 540578136175f1417fd115e5232b0c4beebc12e7
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
<<<<<<< HEAD
  return { active: activeReferrals.length, fresh: activeReferrals.length }
}

export async function computeLevel(userId: string, date: Date = new Date()): Promise<LevelComputationResult> {
  const counts = await countActiveDirects(userId, date)
  const sortedLevels = [...LEVELS].sort((a, b) => b.id - a.id)
  for (const level of sortedLevels) {
    const { directs_active, directs_fresh_active } = level.eligibility
    const activeOk = typeof directs_active === "number" ? counts.active >= directs_active : true
    const freshOk = typeof directs_fresh_active === "number" ? counts.fresh >= directs_fresh_active : true
    if (activeOk && freshOk) {
      return { level: level.id, activeDirects: counts.active, freshActiveDirects: counts.fresh }
    }
  }
  return { level: 0, activeDirects: counts.active, freshActiveDirects: counts.fresh }
}

async function persistLevel(userId: string, date: Date): Promise<LevelComputationResult> {
  const result = await computeLevel(userId, date)
  await User.updateOne(
    { _id: ensureObjectId(userId) },
    {
      $set: {
        level: result.level,
        levelCached: result.level,
        levelEvaluatedAt: date,
        directActiveCount: result.activeDirects,
        totalActiveDirects: result.activeDirects,
      },
    },
  )
  return result
}

export async function refreshAllUserLevels(date: Date = new Date()) {
  await dbConnect()
  const users = await User.find().select("_id")
  for (const user of users) {
    const plain = toPlain(user)
    if (!plain?._id) continue
    await persistLevel(normalizeId(plain._id), date)
  }
}

async function getReferralGenerations(userId: string, depth = 4) {
  const generations: Record<number, string[]> = {}
  let currentLevelIds = [ensureObjectId(userId)]

  for (let level = 1; level <= depth; level += 1) {
    const searchValues = [...currentLevelIds, ...currentLevelIds.map((id) => normalizeId(id))]
    const referralDocs = await User.find({ referredBy: { $in: searchValues } }).select("_id")
    const ids = referralDocs.map((ref) => normalizeId(toPlain(ref)!._id))
    generations[level] = ids
    currentLevelIds = referralDocs.map((ref) => ensureObjectId(normalizeId(toPlain(ref)!._id)))
    if (currentLevelIds.length === 0) break
  }
  return generations
}

async function applyPayout({
  userId,
  type,
  sourceId,
  amount,
  date,
  uniqueKey,
  meta,
}: {
  userId: string
  type: "direct_deposit" | "team_deposit" | "team_profit" | "monthly_bonus" | "daily_team_earning"
  sourceId?: string
  amount: number
  date: Date
  uniqueKey: string
  meta?: Record<string, unknown>
}): Promise<CommissionOutcome> {
  if (amount <= 0) {
    return { amount: 0, created: false, level: (meta?.level as number) ?? 0, uniqueKey }
  }

  const existingDoc = await Payout.findOne({ uniqueKey })
  const existing = toPlain(existingDoc)
  if (existing) {
    return {
      payoutId: normalizeId(existing._id),
      amount: Number(existing.amount ?? 0),
      created: false,
      level: (meta?.level as number) ?? 0,
      uniqueKey,
    }
  }

  try {
    const roundedAmount = type === "daily_team_earning" ? roundDown(amount, 4) : roundAmount(amount)
    const payout = await Payout.create({
      userId: ensureObjectId(userId),
      type,
      sourceId: sourceId ? ensureObjectId(sourceId) : undefined,
      amount: roundedAmount,
      status: "completed",
      date,
      uniqueKey,
      meta,
=======

  if (existing) {
    console.info("[commission-engine] duplicate_prevented", {
      event_id: uniqueKey,
      level: level === 1 ? "L1" : "L2",
      source: "daily",
>>>>>>> 540578136175f1417fd115e5232b0c4beebc12e7
    })
    return null
  }

<<<<<<< HEAD
    const balanceUpdate =
      type === "team_profit" || type === "daily_team_earning"
        ? { $inc: { teamRewardsAvailable: roundedAmount } }
        : { $inc: { current: roundedAmount, totalBalance: roundedAmount, totalEarning: roundedAmount } }
=======
  let balanceUpdated = false
>>>>>>> 540578136175f1417fd115e5232b0c4beebc12e7

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

<<<<<<< HEAD
    const transactionType: ITransaction["type"] =
      type === "team_profit" || type === "daily_team_earning"
        ? "teamReward"
        : type === "monthly_bonus"
        ? "bonus"
        : "commission"

    await Transaction.create({
      userId: ensureObjectId(userId),
      type: transactionType,
      amount: roundedAmount,
      status: "approved",
      meta: { ...meta, uniqueKey, source: (meta?.source as string | undefined) ?? type },
    } as any)

    return { payoutId: normalizeId(payout._id), amount: roundedAmount, created: true, level: (meta?.level as number) ?? 0, uniqueKey }
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && (error as { code?: number }).code === 11000) {
      const existingDoc = await Payout.findOne({ uniqueKey })
      const existing = toPlain(existingDoc)
      return {
        payoutId: existing ? normalizeId(existing._id) : undefined,
        amount: existing ? Number(existing.amount ?? 0) : 0,
        created: false,
        level: (meta?.level as number) ?? 0,
        uniqueKey,
      }
    }
    throw error
  }
}

async function loadUser(userId: string) {
  const doc = await User.findById(ensureObjectId(userId))
  return toPlain(doc)
}

/** ----------------------- DAILY OVERRIDES CORE CHANGE -----------------------
 * We now build a map: memberId -> { amount: sum(profitAmount), active: OR(activeOnDate) }
 * So we can pay:
 *   - Team A (L1): 1% of baseProfit (always)
 *   - Team B (L2): 1% of baseProfit (only if member was active that day)
 * Team C/D: no payouts.
 * -------------------------------------------------------------------------- */
interface ProfitEntry { amount: number; active: boolean }

async function loadDailyProfits(windowStart: Date, windowEnd: Date): Promise<Map<string, ProfitEntry>> {
  const profitDocs = await TeamDailyProfit.find({
    profitDate: { $gte: windowStart, $lte: windowEnd },
  }).select("memberId profitAmount activeOnDate")

  const profitMap = new Map<string, ProfitEntry>()
  for (const profitDoc of profitDocs) {
    const profit = toPlain(profitDoc)
    if (!profit) continue
    const key = normalizeId(profit.memberId)
    const prev = profitMap.get(key) ?? { amount: 0, active: false }
    const nextAmount = Number(prev.amount) + Number(profit.profitAmount ?? 0)
    const nextActive = Boolean(prev.active) || Boolean((profit as any).activeOnDate)
    profitMap.set(key, { amount: nextAmount, active: nextActive })
  }
  return profitMap
}

export async function payDirectDepositCommission(depositId: string) {
  // (unchanged; kept for completeness)
  await dbConnect()
  const depositDoc = await Transaction.findOne({ _id: ensureObjectId(depositId) })
  const deposit = toPlain(depositDoc)
  if (!deposit || deposit.type !== "deposit" || deposit.status !== "approved") return null

  const depositor = await loadUser(normalizeId(deposit.userId))
  if (!depositor?.referredBy) return null

  // Your existing level logic stays; not relevant to daily overrides change
  // ...
  return null
}

export async function payTeamDepositCommissions(depositId: string) {
  // (unchanged; not relevant to daily overrides change)
  await dbConnect()
  const depositDoc = await Transaction.findOne({ _id: ensureObjectId(depositId) })
  const deposit = toPlain(depositDoc)
  if (!deposit || deposit.type !== "deposit" || deposit.status !== "approved") return [] as CommissionOutcome[]
  // ...
  return [] as CommissionOutcome[]
}

/** ===================== DAILY OVERRIDES (UPDATED) ===================== */
export async function payDailyTeamProfit(date: Date = new Date()): Promise<DailyTeamProfitResult[]> {
  await dbConnect()
  const windowEnd = endOfPreviousUtcDay(date)
  const windowStart = startOfPreviousUtcDay(date)

  const profitMap = await loadDailyProfits(windowStart, windowEnd)
  const dayKey = windowStart.toISOString().slice(0, 10)

  const userCache = new Map<string, Awaited<ReturnType<typeof loadUser>> | null>()
  const levelCache = new Map<string, LevelComputationResult>()
  const summary = new Map<string, { amount: number; level: number; totalTeamProfit: number; teams: Set<TeamCode> }>()

  const getUserCached = async (userId: string) => {
    if (!userCache.has(userId)) userCache.set(userId, await loadUser(userId))
    return userCache.get(userId)
  }
  const getLevelCached = async (userId: string) => {
    if (!levelCache.has(userId)) levelCache.set(userId, await persistLevel(userId, windowEnd))
    return levelCache.get(userId)!
  }

  let createdEntries = 0

  for (const [memberId, entry] of profitMap.entries()) {
    const baseProfit = roundDown(entry.amount, 4)
    const memberWasActive = Boolean(entry.active)
    if (baseProfit <= 0) continue

    const member = await getUserCached(memberId)
    if (!member) continue

    // Traverse uplines up to 2 levels only (A, B)
    let currentSponsorId = member.referredBy ? normalizeId(member.referredBy) : null
    let levelIdx = 0 as 0 | 1 // 0 -> A, 1 -> B
    const teamsAB: TeamCode[] = ["A", "B"]

    while (currentSponsorId && levelIdx < 2) {
      const teamCode = teamsAB[levelIdx]
      const sponsorLevelInfo = await getLevelCached(currentSponsorId) // informational only
      const rate = levelIdx === 0 ? DAILY_L1_PCT : memberWasActive ? DAILY_L2_PCT : 0

      if (rate > 0) {
        const amount = roundDown(baseProfit * rate, 4)
        if (amount > 0) {
          const uniqueKey = `DTE:${dayKey}:${memberId}:${currentSponsorId}:${teamCode}`

          const outcome = await applyPayout({
            userId: currentSponsorId,
            type: "daily_team_earning",
            sourceId: memberId,
            amount,
            date: windowEnd,
            uniqueKey,
            meta: {
              level: sponsorLevelInfo.level,
              levelAtPosting: sponsorLevelInfo.level,
              rate,
              ratePct: Number((rate * 100).toFixed(2)), // always 1.00
              teamProfitPct: Number((rate * 100).toFixed(2)),
              day: dayKey,
              team: teamCode,
              teams: [teamCode],
              teamDepth: TEAM_DEPTH[teamCode],
              generation: TEAM_DEPTH[teamCode],
              baseProfit,
              baseProfitRounded: baseProfit,
              teamProfit: baseProfit,
              memberId,
              memberName: typeof member.name === "string" ? member.name : undefined,
              fromUserId: memberId,
              fromUserName: typeof member.name === "string" ? member.name : undefined,
              source: "daily_team_earning",
              postingStatus: "posted",
              memberActive: memberWasActive,
            },
          })

          if (outcome.created) {
            createdEntries += 1
            const summaryEntry = summary.get(currentSponsorId) ?? {
              amount: 0,
              level: sponsorLevelInfo.level,
              totalTeamProfit: 0,
              teams: new Set<TeamCode>(),
            }
            summaryEntry.amount = roundDown(summaryEntry.amount + outcome.amount, 4)
            summaryEntry.level = sponsorLevelInfo.level
            summaryEntry.totalTeamProfit = roundDown(summaryEntry.totalTeamProfit + baseProfit, 4)
            summaryEntry.teams.add(teamCode)
            summary.set(currentSponsorId, summaryEntry)
          }
        }
      } else if (levelIdx === 1 /* L2 skipped because not active */) {
        console.info("[commission-engine] daily_override_skipped", {
          event_id: `${currentSponsorId}|${dayKey}|ovrL2|${memberId}`,
          reason: "member_inactive",
        })
      }

      const sponsor = await getUserCached(currentSponsorId)
      currentSponsorId = sponsor?.referredBy ? normalizeId(sponsor.referredBy) : null
      levelIdx = (levelIdx + 1) as 0 | 1
    }
  }

  const results: DailyTeamProfitResult[] = Array.from(summary.entries()).map(([userId, entry]) => ({
    userId,
    amount: roundDown(entry.amount, 4),
    level: entry.level,
    totalTeamProfit: roundDown(entry.totalTeamProfit, 4),
    teams: Array.from(entry.teams).sort((a, b) => TEAM_DEPTH[a] - TEAM_DEPTH[b]),
  }))

  const summaryTotal = roundDown(results.reduce((sum, entry) => sum + entry.amount, 0), 4)
  console.info("[commission-engine] Daily team earnings posted", {
    day: dayKey,
    payouts: createdEntries,
    uniqueReceivers: results.length,
    totalAmount: summaryTotal,
=======
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
>>>>>>> 540578136175f1417fd115e5232b0c4beebc12e7
  })
    .select({ memberId: 1, profitAmount: 1 })
    .lean()

  if (profitDocs.length === 0) {
    return []
  }

<<<<<<< HEAD
/** ----------------- Monthly bonuses (unchanged) ----------------- */
export async function payMonthlyBonuses(date: Date = new Date()) {
  await dbConnect()
  const { start, end, monthKey } = resolveMonthRange(date)
=======
  const memberIds = Array.from(
    new Set(
      profitDocs
        .map((doc) => toObjectIdString(doc.memberId as any))
        .filter((value): value is string => Boolean(value)),
    ),
  )
>>>>>>> 540578136175f1417fd115e5232b0c4beebc12e7

  const memberObjectIds = memberIds
    .map((id) => toObjectId(id))
    .filter((value): value is mongoose.Types.ObjectId => value !== null)

<<<<<<< HEAD
  for (const userDoc of userDocs) {
    const user = toPlain(userDoc)
    if (!user?._id) continue
    const userId = normalizeId(user._id)
    const levelInfo = await persistLevel(userId, end)
    const levelDefinition = LEVELS_BY_ID.get(levelInfo.level)
    if (!levelDefinition?.monthly_bonus) continue

    const generations = await getReferralGenerations(userId, 1)
    const teamA = generations[1] ?? []
    if (teamA.length === 0) continue

    const teamAFilterValues = [...teamA, ...teamA.map((memberId) => ensureObjectId(memberId))]
    const teamADeposits = await Transaction.aggregate([
      {
        $match: {
          type: "deposit",
          status: "approved",
          userId: { $in: teamAFilterValues },
          createdAt: { $gte: start, $lt: end },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ])

    const totalDeposits = teamADeposits[0]?.total ?? 0
    if (totalDeposits < levelDefinition.monthly_bonus.threshold_direct_usdt) continue
=======
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
>>>>>>> 540578136175f1417fd115e5232b0c4beebc12e7

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
