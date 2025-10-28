import mongoose from "mongoose"

import User from "@/models/User"
import Balance from "@/models/Balance"
import Transaction from "@/models/Transaction"
import CommissionRule, {
  type CommissionTeamCode,
  type MonthlyBonusRule,
  type TeamOverrideRule,
  type ICommissionRule,
} from "@/models/CommissionRule"
import Settings, { type ISettings } from "@/models/Settings"
import Notification from "@/models/Notification"
import LevelHistory from "@/models/LevelHistory"
import {
  LEVEL_PROGRESS_REQUIREMENTS,
  QUALIFYING_DIRECT_DEPOSIT,
  hasQualifiedDeposit,
} from "@/lib/utils/leveling"
import { getPolicyEffectiveAt, isPolicyEffectiveFor } from "@/lib/utils/policy"

const MIN_DEPOSIT_FOR_REWARDS = 80
<<<<<<< HEAD
=======
const SELF_BONUS_PCT = 5
const DIRECT_REFERRAL_PCT = 15
const LEVEL2_OVERRIDE_PCT = 3
const FIRST_DEPOSIT_COMMISSION_AMOUNT = 2
>>>>>>> 540578136175f1417fd115e5232b0c4beebc12e7
const POLICY_ADJUSTMENT_REASON = "policy_update_20240601"
const PLATFORM_DECIMALS = 4

// NEW: L2 override percent fixed to 3%
const LEVEL2_OVERRIDE_PCT = 3

// === Precision: 4 decimal places per platform spec ===
function roundCurrency(amount: number): number {
  return Math.round(amount * 10000) / 10000
}

const LEVEL_THRESHOLDS = LEVEL_PROGRESS_REQUIREMENTS
export const LEVEL_PROGRESSION_THRESHOLDS = LEVEL_THRESHOLDS

function toObjectIdString(id: unknown): string {
  if (id instanceof mongoose.Types.ObjectId) {
    return id.toString()
  }
  if (typeof id === "string") return id
  if (id && typeof (id as { toString: () => string }).toString === "function") {
    return (id as { toString: () => string }).toString()
  }
  throw new Error("Invalid ObjectId value")
}

function resolveMinRewardDeposit(settings?: ISettings | null): number {
  const configuredMin = settings?.gating?.activeMinDeposit ?? MIN_DEPOSIT_FOR_REWARDS
  return Math.max(configuredMin, MIN_DEPOSIT_FOR_REWARDS)
}

<<<<<<< HEAD
=======
function roundCurrency(amount: number, decimals = PLATFORM_DECIMALS): number {
  const factor = 10 ** decimals
  return Math.round(amount * factor) / factor
}

function toObjectId(value: unknown): mongoose.Types.ObjectId {
  const idString = toObjectIdString(value)
  if (!mongoose.isValidObjectId(idString)) {
    throw new Error(`Invalid ObjectId value: ${idString}`)
  }
  return new mongoose.Types.ObjectId(idString)
}

interface TeamRewardCreditOptions {
  userId: mongoose.Types.ObjectId | string
  amount: number
  occurredAt: Date
  uniqueKey: string
  source: string
  meta?: Record<string, unknown>
  logContext?: Record<string, unknown>
}

async function creditTeamReward({
  userId,
  amount,
  occurredAt,
  uniqueKey,
  source,
  meta = {},
  logContext = {},
}: TeamRewardCreditOptions): Promise<"posted" | "duplicate" | "skipped"> {
  const roundedAmount = roundCurrency(amount)
  if (!Number.isFinite(roundedAmount) || roundedAmount <= 0) {
    console.info("[commission] credit_skipped", {
      event_id: uniqueKey,
      source,
      amount: Number.isFinite(roundedAmount) ? roundedAmount : amount,
      ...logContext,
    })
    return "skipped"
  }

  const userObjectId = toObjectId(userId)

  const existing = await Transaction.findOne({
    userId: userObjectId,
    "meta.uniqueEventId": uniqueKey,
  })

  if (existing) {
    console.info("[commission] duplicate_prevented", {
      event_id: uniqueKey,
      source,
      amount: roundedAmount,
      ...logContext,
    })
    return "duplicate"
  }

  await Balance.findOneAndUpdate(
    { userId: userObjectId },
    {
      $inc: {
        teamRewardsAvailable: roundedAmount,
      },
      $setOnInsert: {
        current: 0,
        totalBalance: 0,
        totalEarning: 0,
        lockedCapital: 0,
        lockedCapitalLots: [],
        staked: 0,
        pendingWithdraw: 0,
        teamRewardsClaimed: 0,
        luckyDrawCredits: 0,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  await Transaction.create({
    userId: userObjectId,
    type: "teamReward",
    amount: roundedAmount,
    status: "approved",
    claimable: true,
    meta: {
      source,
      uniqueEventId: uniqueKey,
      uniqueKey,
      eventId: uniqueKey,
      ...meta,
    },
    createdAt: occurredAt,
    updatedAt: occurredAt,
  })

  console.info("[commission] credit", {
    event_id: uniqueKey,
    source,
    amount: roundedAmount,
    ...logContext,
  })

  return "posted"
}

>>>>>>> 540578136175f1417fd115e5232b0c4beebc12e7
function toPlainObject<T = any>(doc: any): T {
  if (!doc) return doc as T
  if (typeof doc.toObject === "function") return doc.toObject() as T
  if (typeof doc === "object") return { ...(doc as Record<string, unknown>) } as T
  return doc as T
}

interface QualificationEvent { achievedAt: Date }

interface LevelProgressComputation {
  level: number
  progressTowardNext: number
  totalActiveDirects: number
  achievements: { level: number; achievedAt: Date }[]
}

function computeLevelProgress(events: QualificationEvent[]): LevelProgressComputation {
  const sortedEvents = [...events].sort((a, b) => a.achievedAt.getTime() - b.achievedAt.getTime())
  let currentLevel = 0
  let progressTowardNext = 0
  const achievements: { level: number; achievedAt: Date }[] = []

  for (const event of sortedEvents) {
    if (currentLevel >= LEVEL_THRESHOLDS.length) break
    progressTowardNext += 1
    const requiredForNext = LEVEL_THRESHOLDS[currentLevel]
    if (progressTowardNext >= requiredForNext) {
      currentLevel += 1
      achievements.push({ level: currentLevel, achievedAt: event.achievedAt })
      progressTowardNext = 0
    }
  }
  if (currentLevel >= LEVEL_THRESHOLDS.length) progressTowardNext = 0

  return { level: currentLevel, progressTowardNext, totalActiveDirects: sortedEvents.length, achievements }
}

function resolveMonthRange(month?: string) {
  let year: number
  let monthIndex: number

  if (typeof month === "string" && month.length > 0) {
    const [y, m] = month.split("-")
    year = Number.parseInt(y ?? "", 10)
    monthIndex = Number.parseInt(m ?? "", 10) - 1
  } else {
    const now = new Date()
    year = now.getUTCFullYear()
    monthIndex = now.getUTCMonth()
  }

  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    throw new Error("Invalid month provided. Expected format YYYY-MM")
  }

  const start = new Date(Date.UTC(year, monthIndex, 1))
  const end = new Date(Date.UTC(year, monthIndex + 1, 1))
  const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`
  return { start, end, monthKey }
}

const commissionRuleCache = new Map<number, ICommissionRule>()

async function getCommissionRuleForLevel(level: number): Promise<ICommissionRule | null> {
  if (commissionRuleCache.has(level)) return commissionRuleCache.get(level) ?? null
  const rule = await CommissionRule.findOne({ level })
  if (rule) commissionRuleCache.set(level, rule)
  return rule
}

export async function rebuildActiveMemberFlags() {
  const settings = await Settings.findOne()
  const threshold = resolveMinRewardDeposit(settings)

  await User.updateMany({}, { $set: { isActive: false } })
  await User.updateMany(
    { depositTotal: { $gte: threshold }, referredBy: { $exists: true, $ne: null } },
    { $set: { isActive: true } },
  )

  await User.updateMany(
    { depositTotal: { $gte: QUALIFYING_DIRECT_DEPOSIT } },
    { $set: { qualified: true } },
  )

  return { threshold }
}

function depthToTeam(depth: number): CommissionTeamCode | null {
  switch (depth) {
    case 1: return "A"
    case 2: return "B"
    case 3: return "C"
    case 4: return "D"
    default: return null
  }
}

interface DirectCommissionComputation {
  sponsor: any
  sponsorLevel: number
  amount: number
  commissionPct: number
}

interface OverrideCommissionDetail {
  sponsor: any
  amount: number
  commissionPct: number
  level: number
}

interface DirectCommissionResult extends DirectCommissionComputation {
  override?: OverrideCommissionDetail | null
}

async function resolveDirectCommission(
  referredUser: any,
  depositAmount: number,
): Promise<DirectCommissionComputation | null> {
  const sponsorId = referredUser?.referredBy
  if (!sponsorId) return null

  const sponsor = await User.findById(sponsorId)
  if (!sponsor) return null

  if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
    return null
  }

  const amount = roundCurrency(depositAmount * (DIRECT_REFERRAL_PCT / 100))
  if (amount <= 0) {
    return null
  }

  return { sponsor, sponsorLevel: 1, amount, commissionPct: DIRECT_REFERRAL_PCT }
}

interface TeamOverridePayout {
  sponsor: any
  sponsorLevel: number
  override: TeamOverrideRule
  team: CommissionTeamCode
  depth: number
  amount: number
  kind: TeamOverrideRule["kind"]
}

async function resolveTeamProfitOverrides(
  earningUser: any,
  profitAmount: number,
  maxDepth = 4,
  persistLevels = true,
): Promise<TeamOverridePayout[]> {
  if (!earningUser || profitAmount <= 0) return []
  const chain = await buildReferralChain(earningUser, maxDepth)
  if (chain.length === 0) return []

  const payouts: TeamOverridePayout[] = []
  for (const { level: depth, user: sponsor } of chain) {
    const team = depthToTeam(depth)
    if (!team) continue

    const sponsorLevel = await calculateUserLevel(toObjectIdString(sponsor._id), {
      persist: persistLevels,
      notify: persistLevels,
    })
    const rule = await getCommissionRuleForLevel(sponsorLevel)
    if (!rule || !Array.isArray(rule.teamOverrides) || rule.teamOverrides.length === 0) continue

    for (const override of rule.teamOverrides) {
      if (override.appliesTo !== "profit" || override.depth !== depth || override.team !== team) continue
      const amount = roundCurrency((profitAmount * override.pct) / 100)
      if (amount <= 0) continue
      payouts.push({ sponsor, sponsorLevel, override, team, depth, amount, kind: override.kind })
    }
  }
  return payouts
}

interface CalculateUserLevelOptions { persist?: boolean; notify?: boolean }

export async function calculateUserLevel(
  _userId: string,
  _options: CalculateUserLevelOptions = {},
): Promise<number> {
<<<<<<< HEAD
  const [user, directReferrals] = await Promise.all([
    User.findById(userId),
    User.find({ referredBy: userId }).select("qualified qualifiedAt depositTotal createdAt updatedAt"),
  ])
  if (!user) return 0

  const shouldPersist = options.persist ?? true
  const shouldNotify = options.notify ?? true

  const qualificationEvents: QualificationEvent[] = []
  const qualifiedAtUpdates: Array<{ filter: any; update: any }> = []

  for (const referral of directReferrals) {
    if (!hasQualifiedDeposit(referral)) continue
    const fallbackDate =
      referral.qualifiedAt ?? referral.updatedAt ?? referral.createdAt ?? new Date(0)
    qualificationEvents.push({ achievedAt: fallbackDate })

    if (shouldPersist) {
      const update: Record<string, unknown> = {}
      if (!referral.qualified) update.qualified = true
      if (!referral.qualifiedAt) update.qualifiedAt = fallbackDate
      if (Object.keys(update).length > 0) {
        qualifiedAtUpdates.push({ filter: { _id: referral._id }, update: { $set: update } })
      }
    }
  }

  const { level, progressTowardNext, totalActiveDirects, achievements } =
    computeLevelProgress(qualificationEvents)

  const resolvedLevel = level
  const resolvedProgress = progressTowardNext
  const resolvedLastLevelUpAt =
    achievements.length > 0 ? achievements[achievements.length - 1].achievedAt : null

  const updates: Record<string, unknown> = {
    level: resolvedLevel,
    directActiveCount: resolvedProgress,
    totalActiveDirects,
    lastLevelUpAt: resolvedLastLevelUpAt,
  }

  if (shouldPersist) {
    await User.updateOne({ _id: userId }, { $set: updates })

    if (qualifiedAtUpdates.length > 0) {
      await User.bulkWrite(qualifiedAtUpdates.map((operation) => ({ updateOne: operation })))
    }

    if (typeof (LevelHistory as any)?.deleteMany === "function") {
      await LevelHistory.deleteMany({ userId, level: { $gt: resolvedLevel } })
    }

    if (achievements.length > 0 && typeof (LevelHistory as any)?.updateOne === "function") {
      await Promise.all(
        achievements.map((achievement) =>
          LevelHistory.updateOne(
            { userId, level: achievement.level },
            { $set: { achievedAt: achievement.achievedAt } },
            { upsert: true },
          ),
        ),
      )
    } else if (typeof (LevelHistory as any)?.deleteMany === "function") {
      await LevelHistory.deleteMany({ userId })
    }

    if (shouldNotify && resolvedLevel > (user.level ?? 0)) {
      await Notification.create({
        userId,
        kind: "level-up",
        title: "Level Up!",
        body: `Congratulations! You've reached Level ${resolvedLevel}`,
      })
    }
  }

  return resolvedLevel
=======
  return 0
>>>>>>> 540578136175f1417fd115e5232b0c4beebc12e7
}

interface RecalculateUserLevelsOptions extends CalculateUserLevelOptions { syncActiveFlags?: boolean }

<<<<<<< HEAD
export async function recalculateAllUserLevels(options: RecalculateUserLevelsOptions = {}) {
  if (options.syncActiveFlags !== false) await rebuildActiveMemberFlags()
  const users = await User.find().select("_id")
  for (const user of users) {
    await calculateUserLevel(toObjectIdString(user._id), {
      persist: options.persist ?? true,
      notify: options.notify ?? false,
    })
  }
=======
export async function recalculateAllUserLevels(_options: RecalculateUserLevelsOptions = {}) {
  return { updated: 0 }
>>>>>>> 540578136175f1417fd115e5232b0c4beebc12e7
}

interface ReferralChainEntry { level: number; user: any }

async function buildReferralChain(startingUser: any, maxLevels: number): Promise<ReferralChainEntry[]> {
  const chain: ReferralChainEntry[] = []
  let current: any = startingUser
  for (let level = 1; level <= maxLevels; level++) {
    const sponsorId = current?.referredBy
    if (!sponsorId) break
    const sponsor = await User.findById(sponsorId)
    if (!sponsor) break
    chain.push({ level, user: sponsor })
    current = sponsor
  }
  return chain
}

interface ReferralCommissionOptions {
  depositTransactionId?: string
  depositAt?: Date
  adjustmentReason?: string
  dryRun?: boolean
  qualifiesForActivation?: boolean
  activationId?: string
  forceActivation?: boolean
}

/**
 * UPDATED:
 * - Direct (L1) commission: pay on EVERY deposit (no activation gate)
 * - L2 3% override: only when activation qualifies (deposit ≥ min OR forceActivation)
 * - Idempotency via meta.uniqueEventId
 */
export async function processReferralCommission(
  referredUserId: string,
  depositAmount: number,
  settings?: ISettings | null,
  minRewardDeposit?: number,
  options: ReferralCommissionOptions = {},
): Promise<DirectCommissionResult | null> {
  const referredUser = await User.findById(referredUserId)
  if (!referredUser) return null

  const resolvedSettings = settings ?? (await Settings.findOne())
  const requiredDeposit = minRewardDeposit ?? resolveMinRewardDeposit(resolvedSettings)

<<<<<<< HEAD
  // Direct commission now ALWAYS computed (no activation gate)
  const payout = await resolveDirectCommission(referredUser, depositAmount)
  if (!payout) return null

  const occurredAt = options.depositAt ?? new Date()
  const activationId =
    options.depositTransactionId ?? `manual:${referredUserId}:${occurredAt.toISOString()}`
  const sponsorIdStr = toObjectIdString(payout.sponsor._id)
  const directUniqueKey = `${sponsorIdStr}|${activationId}|L1_15`

  if (options.dryRun) return payout

  // --- Idempotency: Direct L1 ---
  const existingDirect = await Transaction.findOne({
    userId: payout.sponsor._id,
    "meta.uniqueEventId": directUniqueKey,
  })
  if (existingDirect) {
    console.info("[commission] duplicate_prevented", {
      event_id: directUniqueKey,
      source: "direct_referral",
      level: "L1",
      percentage: payout.rule.directPct,
      base_amount: roundCurrency(depositAmount),
    })
  } else {
    await Balance.updateOne(
      { userId: payout.sponsor._id },
      {
        $inc: {
          current: payout.amount,
          totalBalance: payout.amount,
          totalEarning: payout.amount,
        },
      },
      { upsert: true },
    )

    await Transaction.create({
      userId: payout.sponsor._id,
      type: "commission",
      amount: payout.amount,
      status: "approved",
      meta: {
        source: "direct_referral",
        uniqueEventId: directUniqueKey,
        referredUserId,
        referredUserName: referredUser.name ?? null,
        depositAmount,
        commissionPct: payout.rule.directPct, // typically 15%
        sponsorLevel: payout.sponsorLevel,
        depositTransactionId: options.depositTransactionId ?? null,
        policyVersion: POLICY_ADJUSTMENT_REASON,
        ...(options.adjustmentReason ? { adjustment_reason: options.adjustmentReason } : {}),
      },
      createdAt: occurredAt,
      updatedAt: occurredAt,
    })

    console.info("[commission] credit", {
      event_id: directUniqueKey,
      source: "direct_referral",
      level: "L1",
      percentage: payout.rule.directPct,
      amount: payout.amount,
      base_amount: roundCurrency(depositAmount),
    })
=======
  const occurredAt = options.depositAt ?? new Date()
  if (!isPolicyEffectiveFor(occurredAt)) {
    return null
  }

  const activationAmount = roundCurrency(depositAmount)
  const isActivationEvent = Boolean(options.qualifiesForActivation || options.forceActivation)

  if (!isActivationEvent) {
    console.info("[commission] activation_skipped", {
      event_id: `activation:${options.activationId ?? options.depositTransactionId ?? "manual"}`,
      reason: "not_activation_event",
      activationAmount,
    })
    return null
  }

  const payout = await resolveDirectCommission(referredUser, activationAmount)
  if (!payout) return null

  const activationId =
    options.activationId ??
    options.depositTransactionId ??
    `manual:${referredUserId}:${occurredAt.toISOString()}`
  const sponsorIdString = toObjectIdString(payout.sponsor._id)
  const directUniqueKey = `${sponsorIdString}|${activationId}|L1_15`

  const result: DirectCommissionResult = { ...payout }

  const overrideDetail: OverrideCommissionDetail | null = await (async () => {
    if (!options.qualifiesForActivation && !options.forceActivation) {
      return null
    }

    const leaderSponsorId = payout.sponsor?.referredBy
    if (!leaderSponsorId) {
      console.info("[commission] activation_override_skipped", {
        event_id: `activation:${activationId}:l2`,
        reason: "missing_level2",
      })
      return null
    }

    const leaderSponsor = await User.findById(leaderSponsorId)
    if (!leaderSponsor) {
      console.info("[commission] activation_override_skipped", {
        event_id: `activation:${activationId}:l2`,
        reason: "missing_level2",
      })
      return null
    }

    if (activationAmount < MIN_DEPOSIT_FOR_REWARDS) {
      console.info("[commission] activation_override_skipped", {
        event_id: `activation:${activationId}:l2`,
        reason: "activation_below_threshold",
        activationAmount,
      })
      return null
    }

    const overrideAmount = roundCurrency(activationAmount * (LEVEL2_OVERRIDE_PCT / 100))
    if (overrideAmount <= 0) {
      return null
    }

    return {
      sponsor: leaderSponsor,
      amount: overrideAmount,
      commissionPct: LEVEL2_OVERRIDE_PCT,
      level: 2,
    }
  })()

  result.override = overrideDetail

  if (options.dryRun) {
    return result
  }

  if (!options.dryRun) {
    const creditResult = await creditTeamReward({
      userId: sponsorIdString,
      amount: payout.amount,
      occurredAt,
      uniqueKey: directUniqueKey,
      source: "activation_direct",
      meta: {
        referredUserId,
        referredUserName: referredUser.name ?? null,
        depositAmount: activationAmount,
        commissionBase: activationAmount,
        commissionPct: payout.commissionPct,
        sponsorLevel: payout.sponsorLevel,
        depositTransactionId: options.depositTransactionId ?? null,
        policyVersion: POLICY_ADJUSTMENT_REASON,
        activationId,
        ...(options.adjustmentReason ? { adjustment_reason: options.adjustmentReason } : {}),
      },
      logContext: {
        level: "L1",
        percentage: payout.commissionPct,
        base_amount: activationAmount,
      },
    })

    if (creditResult === "posted") {
      await Notification.create({
        userId: toObjectId(sponsorIdString),
        kind: "referral-joined",
        title: "Referral Commission Earned",
        body: `You earned $${payout.amount.toFixed(4)} commission from ${referredUser.name}'s activation`,
      })
    }
>>>>>>> 540578136175f1417fd115e5232b0c4beebc12e7
  }

  if (overrideDetail) {
    const overrideSponsorId = toObjectIdString(overrideDetail.sponsor._id)
    const overrideUniqueKey = `${overrideSponsorId}|${activationId}|L2_3`

<<<<<<< HEAD
  // --- L2 3% override (activation) ---
  const qualifiesForActivation =
    depositAmount >= requiredDeposit || Boolean(options.qualifiesForActivation)
  if (qualifiesForActivation) {
    const l2Id = payout.sponsor?.referredBy
    if (!l2Id) {
      console.info("[commission] activation_override_skipped", {
        event_id: `activation:${activationId}:l2`,
        reason: "missing_level2",
      })
      return payout
    }
    const leader2 = await User.findById(l2Id)
    if (!leader2) {
      console.info("[commission] activation_override_skipped", {
        event_id: `activation:${activationId}:l2`,
        reason: "missing_level2",
      })
      return payout
    }

    const activationAmount = roundCurrency(depositAmount)
    const l2Amount = roundCurrency((activationAmount * LEVEL2_OVERRIDE_PCT) / 100)
    if (l2Amount > 0) {
      const l2Key = `${toObjectIdString(leader2._id)}|${activationId}|L2_3`
      const existingL2 = await Transaction.findOne({
        userId: leader2._id,
        "meta.uniqueEventId": l2Key,
      })
      if (existingL2) {
        console.info("[commission] duplicate_prevented", {
          event_id: l2Key,
          source: "activation_level2_override",
          level: "L2",
          percentage: LEVEL2_OVERRIDE_PCT,
          base_amount: activationAmount,
        })
      } else {
        await Balance.updateOne(
          { userId: leader2._id },
          {
            $inc: {
              current: l2Amount,
              totalBalance: l2Amount,
              totalEarning: l2Amount,
            },
          },
          { upsert: true },
        )
        await Transaction.create({
          userId: leader2._id,
          type: "commission",
          amount: l2Amount,
          status: "approved",
          meta: {
            source: "activation_level2_override",
            uniqueEventId: l2Key,
            referredUserId,
            referredUserName: referredUser.name ?? null,
            depositAmount: activationAmount,
            commissionPct: LEVEL2_OVERRIDE_PCT,
            sponsorLevel: payout.sponsorLevel,
            depositTransactionId: options.depositTransactionId ?? null,
            policyVersion: POLICY_ADJUSTMENT_REASON,
            ...(options.adjustmentReason ? { adjustment_reason: options.adjustmentReason } : {}),
          },
          createdAt: occurredAt,
          updatedAt: occurredAt,
        })
        console.info("[commission] credit", {
          event_id: l2Key,
          source: "activation_level2_override",
          level: "L2",
          percentage: LEVEL2_OVERRIDE_PCT,
          amount: l2Amount,
          base_amount: activationAmount,
        })
      }
    }
  }

  return payout
=======
    if (!options.dryRun) {
      await creditTeamReward({
        userId: overrideSponsorId,
        amount: overrideDetail.amount,
        occurredAt,
        uniqueKey: overrideUniqueKey,
        source: "activation_level2_override",
        meta: {
          referredUserId,
          referredUserName: referredUser.name ?? null,
          depositAmount: activationAmount,
          commissionBase: activationAmount,
          commissionPct: overrideDetail.commissionPct,
          sponsorLevel: overrideDetail.level,
          depositTransactionId: options.depositTransactionId ?? null,
          policyVersion: POLICY_ADJUSTMENT_REASON,
          activationId,
          ...(options.adjustmentReason ? { adjustment_reason: options.adjustmentReason } : {}),
        },
        logContext: {
          level: "L2",
          percentage: overrideDetail.commissionPct,
          base_amount: activationAmount,
        },
      })
    }
  }

  return result
>>>>>>> 540578136175f1417fd115e5232b0c4beebc12e7
}

interface TeamOverrideContext {
  profitTransactionId?: string
  profitDate?: Date
  profitSource?: string
  baseAmount?: number
  adjustmentReason?: string
  dryRun?: boolean
}

export async function applyTeamProfitOverrides(
  _earningUserId: string,
  _profitAmount: number,
  _context: TeamOverrideContext = {},
) {
<<<<<<< HEAD
  if (profitAmount <= 0) return []

  const earningUser = await User.findById(earningUserId)
  if (!earningUser) return []

  const overrides = await resolveTeamProfitOverrides(
    earningUser,
    profitAmount,
    4,
    !context.dryRun,
  )
  if (overrides.length === 0) return []

  const profitDate = context.profitDate ?? new Date()
  const results: TeamOverridePayout[] = []

  for (const payout of overrides) {
    results.push(payout)
    if (context.dryRun) continue

    const baseMeta = {
      source: "team_override",
      payoutType: payout.override.payout,
      team: payout.team,
      depth: payout.depth,
      overridePct: payout.override.pct,
      overrideKind: payout.kind,
      sponsorLevel: payout.sponsorLevel,
      profitAmount,
      ...(typeof context.baseAmount === "number" ? { baseAmount: context.baseAmount } : {}),
      profitTransactionId: context.profitTransactionId ?? null,
      profitSource: context.profitSource ?? "mining",
      profitDate: profitDate.toISOString(),
      fromUserId: earningUserId,
      fromUserName: earningUser.name ?? null,
      policyVersion: POLICY_ADJUSTMENT_REASON,
      ...(context.adjustmentReason ? { adjustment_reason: context.adjustmentReason } : {}),
    }

    if (payout.override.payout === "commission") {
      await Balance.updateOne(
        { userId: payout.sponsor._id },
        {
          $inc: {
            current: payout.amount,
            totalBalance: payout.amount,
            totalEarning: payout.amount,
          },
        },
        { upsert: true },
      )

      await Transaction.create({
        userId: payout.sponsor._id,
        type: "commission",
        amount: payout.amount,
        meta: baseMeta,
        status: "approved",
      })
    } else {
      await Balance.updateOne(
        { userId: payout.sponsor._id },
        {
          $inc: {
            teamRewardsAvailable: payout.amount,
          },
        },
        { upsert: true },
      )

      await Transaction.create({
        userId: payout.sponsor._id,
        type: "bonus",
        amount: payout.amount,
        meta: { ...baseMeta, accrual: true },
        status: "approved",
      })
    }
  }

  return results
=======
  return []
>>>>>>> 540578136175f1417fd115e5232b0c4beebc12e7
}

interface PolicyRecalculateOptions { dryRun?: boolean; adjustmentReason?: string }

interface MonthlyBonusPayoutResult {
  userId: string
  amount: number
  bonusType: MonthlyBonusRule["type"]
  label: string
  threshold: number
  teamSales: number
  level: number
  alreadyPaid: number
  action: "awarded" | "adjusted" | "calculated"
  transactionId?: string
}

export async function policyRecalculateCommissions(
  month?: string,
  options: PolicyRecalculateOptions = {},
) {
  await recalculateAllUserLevels({ persist: true, notify: false })
  commissionRuleCache.clear()

  const { start, end, monthKey } = resolveMonthRange(month)

  const deposits = await Transaction.find({
    type: "deposit",
    status: "approved",
    amount: { $gte: MIN_DEPOSIT_FOR_REWARDS },
    createdAt: { $gte: start, $lt: end },
  })
    .select("_id userId amount createdAt")
    .lean()

  if (deposits.length === 0) {
    return { month: monthKey, payouts: [] as MonthlyBonusPayoutResult[] }
  }

  const depositorIds = Array.from(new Set(deposits.map((tx) => tx.userId.toString())))
  const depositors = await User.find({ _id: { $in: depositorIds } })
    .select("_id referredBy name")
    .lean()

  const sponsorMap = new Map<string, { sponsorId: string; name?: string }>()
  for (const depositor of depositors) {
    if (!depositor?.referredBy) continue
    sponsorMap.set(toObjectIdString(depositor._id), {
      sponsorId: depositor.referredBy.toString(),
      name: depositor.name as string | undefined,
    })
  }

  const salesMap = new Map<string, { total: number; deposits: string[] }>()
  for (const deposit of deposits) {
    const referral = sponsorMap.get(deposit.userId.toString())
    if (!referral) continue

    const entry = salesMap.get(referral.sponsorId) ?? { total: 0, deposits: [] }
    entry.total = roundCurrency(entry.total + (deposit.amount ?? 0))
    entry.deposits.push(toObjectIdString(deposit._id))
    salesMap.set(referral.sponsorId, entry)
  }

  const sponsorIds = Array.from(salesMap.keys())
  if (sponsorIds.length === 0) {
    return { month: monthKey, payouts: [] as MonthlyBonusPayoutResult[] }
  }

  const sponsors = await User.find({ _id: { $in: sponsorIds } })
    .select("_id name level")
    .lean()

  const existingBonuses = await Transaction.find({
    userId: { $in: sponsorIds },
    type: "bonus",
    "meta.source": "monthly_policy_bonus",
    "meta.month": monthKey,
  })
    .select("userId amount meta")
    .lean()

  const existingBonusMap = new Map<string, any>()
  for (const bonusTx of existingBonuses) {
    const bonusType = bonusTx.meta?.bonusType ?? "bonus"
    const key = `${bonusTx.userId.toString()}::${bonusType}`
    existingBonusMap.set(key, bonusTx)
  }

  const payouts: MonthlyBonusPayoutResult[] = []

  for (const sponsor of sponsors) {
    const sponsorId = toObjectIdString(sponsor._id)
    const salesEntry = salesMap.get(sponsorId)
    if (!salesEntry) continue

    const currentLevel = await calculateUserLevel(sponsorId, { persist: false, notify: false })
    const rule = await getCommissionRuleForLevel(currentLevel)
    if (!rule || !Array.isArray(rule.monthlyBonuses) || rule.monthlyBonuses.length === 0) continue

    for (const bonusRule of rule.monthlyBonuses) {
      if (salesEntry.total < bonusRule.threshold) continue

      const key = `${sponsorId}::${bonusRule.type}`
      const existing = existingBonusMap.get(key)
      const alreadyPaid = existing?.amount ? roundCurrency(existing.amount) : 0
      const delta = roundCurrency(bonusRule.amount - alreadyPaid)
      if (delta <= 0) continue

      const action: MonthlyBonusPayoutResult["action"] =
        alreadyPaid > 0 ? "adjusted" : options.dryRun ? "calculated" : "awarded"

      payouts.push({
        userId: sponsorId,
        amount: delta,
        bonusType: bonusRule.type,
        label: bonusRule.label,
        threshold: bonusRule.threshold,
        teamSales: salesEntry.total,
        level: currentLevel,
        alreadyPaid,
        action: options.dryRun ? "calculated" : action,
        transactionId: existing?._id?.toString(),
      })

      if (options.dryRun) continue

      await Balance.updateOne(
        { userId: sponsorId },
        {
          $inc: {
            current: delta,
            totalBalance: delta,
            totalEarning: delta,
          },
        },
        { upsert: true },
      )

      await Transaction.create({
        userId: sponsorId,
        type: "bonus",
        amount: delta,
        status: "approved",
        meta: {
          source: "monthly_policy_bonus",
          month: monthKey,
          bonusType: bonusRule.type,
          label: bonusRule.label,
          threshold: bonusRule.threshold,
          teamSales: salesEntry.total,
          deposits: salesEntry.deposits,
          policyVersion: POLICY_ADJUSTMENT_REASON,
          ...(options.adjustmentReason ? { adjustment_reason: options.adjustmentReason } : {}),
        },
      })
    }
  }

  return { month: monthKey, payouts }
}

export const policy_recalculate_commissions = policyRecalculateCommissions

interface PolicyAdjustmentOptions extends PolicyRecalculateOptions { start?: Date; end?: Date }
type AdjustmentType = "direct_commission" | "team_commission" | "team_reward" | "daily_override"

interface PolicyAdjustmentResult {
  type: AdjustmentType
  userId: string
  amount: number
  expected: number
  previouslyPaid: number
  referenceId: string
  action: "calculated" | "adjusted"
}

export async function policyApplyRetroactiveAdjustments(
  _options: PolicyAdjustmentOptions = {},
) {
<<<<<<< HEAD
  await recalculateAllUserLevels({ persist: true, notify: false })
  commissionRuleCache.clear()

  const adjustmentReason = options.adjustmentReason ?? POLICY_ADJUSTMENT_REASON
  const start = options.start ?? new Date(0)
  const end = options.end ?? new Date()

  const results: PolicyAdjustmentResult[] = []

  const deposits = await Transaction.find({
    type: "deposit",
    status: "approved",
    amount: { $gte: MIN_DEPOSIT_FOR_REWARDS },
    createdAt: { $gte: start, $lte: end },
  })
    .select("_id userId amount createdAt")
    .lean()

  const userCache = new Map<string, any>()

  for (const deposit of deposits) {
    const userId = deposit.userId.toString()
    let referredUser = userCache.get(userId)
    if (!referredUser) {
      const fetchedUser = await User.findById(userId)
      if (fetchedUser) {
        const plainUser = toPlainObject(fetchedUser)
        referredUser = { _id: plainUser._id, referredBy: plainUser.referredBy, name: plainUser.name }
        userCache.set(userId, referredUser)
      }
    }
    if (!referredUser) continue

    const payout = await resolveDirectCommission(referredUser, deposit.amount ?? 0, { persistLevel: false })
    if (!payout) continue

    const sponsorId = toObjectIdString(payout.sponsor._id)

    const paidTransactions = await Transaction.find({
      userId: payout.sponsor._id,
      type: { $in: ["commission", "adjust"] },
      $or: [
        { "meta.depositTransactionId": toObjectIdString(deposit._id) },
        {
          "meta.source": { $in: ["direct_referral", "direct_commission_adjustment"] },
          "meta.referredUserId": userId,
          "meta.depositAmount": deposit.amount,
        },
      ],
    })
      .select("amount")
      .lean()

    const alreadyPaid = roundCurrency(paidTransactions.reduce((sum, tx) => sum + (tx.amount ?? 0), 0))
    const delta = roundCurrency(payout.amount - alreadyPaid)
    if (Math.abs(delta) <= 0) continue

    results.push({
      type: "direct_commission",
      userId: sponsorId,
      amount: delta,
      expected: payout.amount,
      previouslyPaid: alreadyPaid,
      referenceId: toObjectIdString(deposit._id),
      action: options.dryRun ? "calculated" : "adjusted",
    })

    if (options.dryRun) continue

    await Balance.updateOne(
      { userId: payout.sponsor._id },
      {
        $inc: { current: delta, totalBalance: delta, totalEarning: delta },
      },
      { upsert: true },
    )

    await Transaction.create({
      userId: payout.sponsor._id,
      type: "adjust",
      amount: delta,
      status: "approved",
      meta: {
        source: "direct_commission_adjustment",
        depositTransactionId: toObjectIdString(deposit._id),
        referredUserId: userId,
        expectedAmount: payout.amount,
        previouslyPaid: alreadyPaid,
        policyVersion: POLICY_ADJUSTMENT_REASON,
        adjustment_reason: adjustmentReason,
      },
    })
  }

  const profitTransactions = await Transaction.find({
    type: "earn",
    status: "approved",
    createdAt: { $gte: start, $lte: end },
    "meta.source": "mining",
  })
    .select("_id userId amount meta createdAt")
    .lean()

  const profitIds = profitTransactions.map((tx) => toObjectIdString(tx._id))
  const overridePayments = profitIds.length
    ? await Transaction.find({
        "meta.profitTransactionId": { $in: profitIds },
        "meta.source": { $in: ["team_override", "team_override_adjustment"] },
      })
        .select("userId amount meta")
        .lean()
    : []

  const paymentsByProfit = new Map<string, any[]>()
  for (const payment of overridePayments) {
    const profitId = payment.meta?.profitTransactionId
    if (!profitId) continue
    const list = paymentsByProfit.get(profitId) ?? []
    list.push(payment)
    paymentsByProfit.set(profitId, list)
  }

  for (const profit of profitTransactions) {
    const expectedOverrides = await applyTeamProfitOverrides(profit.userId.toString(), profit.amount ?? 0, {
      dryRun: true,
      profitTransactionId: toObjectIdString(profit._id),
      profitDate: profit.createdAt,
      profitSource: profit.meta?.source ?? "mining",
      baseAmount: profit.meta?.baseAmount,
    })
    if (!expectedOverrides.length) continue

    const existing = paymentsByProfit.get(toObjectIdString(profit._id)) ?? []
    for (const payout of expectedOverrides) {
      const sponsorId = toObjectIdString(payout.sponsor._id)
      const matchedPayments = existing.filter(
        (tx) =>
          tx.userId?.toString() === sponsorId &&
          tx.meta?.team === payout.team &&
          Number(tx.meta?.overridePct) === payout.override.pct &&
          tx.meta?.payoutType === payout.override.payout &&
          (tx.meta?.overrideKind ?? payout.kind) === payout.kind,
      )

      const alreadyPaid = roundCurrency(matchedPayments.reduce((sum, tx) => sum + (tx.amount ?? 0), 0))
      const delta = roundCurrency(payout.amount - alreadyPaid)
      if (Math.abs(delta) <= 0) continue

      let type: AdjustmentType
      switch (payout.kind) {
        case "team_reward": type = "team_reward"; break
        case "daily_override": type = "daily_override"; break
        default: type = "team_commission"
      }

      results.push({
        type,
        userId: sponsorId,
        amount: delta,
        expected: payout.amount,
        previouslyPaid: alreadyPaid,
        referenceId: toObjectIdString(profit._id),
        action: options.dryRun ? "calculated" : "adjusted",
      })

      if (options.dryRun) continue

      if (payout.override.payout === "commission") {
        await Balance.updateOne(
          { userId: payout.sponsor._id },
          { $inc: { current: delta, totalBalance: delta, totalEarning: delta } },
          { upsert: true },
        )
      } else {
        await Balance.updateOne(
          { userId: payout.sponsor._id },
          { $inc: { teamRewardsAvailable: delta } },
          { upsert: true },
        )
      }

      await Transaction.create({
        userId: payout.sponsor._id,
        type: "adjust",
        amount: delta,
        status: "approved",
        meta: {
          source: "team_override_adjustment",
          profitTransactionId: toObjectIdString(profit._id),
          fromUserId: profit.userId.toString(),
          payoutType: payout.override.payout,
          team: payout.team,
          overridePct: payout.override.pct,
          overrideKind: payout.kind,
          expectedAmount: payout.amount,
          previouslyPaid: alreadyPaid,
          policyVersion: POLICY_ADJUSTMENT_REASON,
          adjustment_reason: adjustmentReason,
        },
      })
    }
  }

  return results
=======
  return [] as PolicyAdjustmentResult[]
>>>>>>> 540578136175f1417fd115e5232b0c4beebc12e7
}

export const policy_apply_retroactive_adjustments = policyApplyRetroactiveAdjustments

// ====== UPDATED: Self-bonus 5% on each approved deposit (idempotent) ======

interface DepositRewardOptions {
  depositTransactionId?: string
  depositAt?: Date
  adjustmentReason?: string
  dryRun?: boolean
  activationId?: string
  forceActivation?: boolean
}

export async function applyDepositRewards(
  userId: string,
  depositAmount: number,
  options: DepositRewardOptions = {},
) {
  const [settings, userDoc] = await Promise.all([Settings.findOne(), User.findById(userId)])
  const requiredDeposit = resolveMinRewardDeposit(settings)
<<<<<<< HEAD

  // Activation gates
  const qualifiesForActivation = Boolean(userDoc && !userDoc.isActive && userDoc.depositTotal >= requiredDeposit)
  const qualifiesForRewards = depositAmount >= requiredDeposit || qualifiesForActivation
=======
  const qualifiesForActivation = Boolean(
    userDoc && !userDoc.isActive && userDoc.depositTotal >= requiredDeposit,
  )
  const isActivationEvent = Boolean(qualifiesForActivation || options.forceActivation)
>>>>>>> 540578136175f1417fd115e5232b0c4beebc12e7

  const updatedDepositTotal = Number(userDoc?.depositTotal ?? 0)
  const qualifiesForDirectActivation = updatedDepositTotal >= QUALIFYING_DIRECT_DEPOSIT
  const newlyQualified = qualifiesForDirectActivation && Boolean(userDoc) && !Boolean(userDoc?.qualified)
  const sponsorId = userDoc?.referredBy ? userDoc.referredBy.toString() : null

  if (newlyQualified && !options.dryRun) {
    const qualifiedAt = options.depositAt ?? new Date()
    await User.updateOne({ _id: userId }, { $set: { qualified: true, qualifiedAt } })
  } else if (qualifiesForDirectActivation && userDoc?.qualified && !userDoc?.qualifiedAt && !options.dryRun) {
    const qualifiedAt = options.depositAt ?? new Date()
    await User.updateOne({ _id: userId }, { $set: { qualifiedAt } })
  }

  const results: {
<<<<<<< HEAD
    selfBonus?: number
    directCommission?: DirectCommissionComputation | null
=======
    depositCommission?: number
    directCommission?: DirectCommissionResult | null
    overrideCommission?: OverrideCommissionDetail | null
>>>>>>> 540578136175f1417fd115e5232b0c4beebc12e7
    activated: boolean
    activationThreshold: number
    selfBonus?: number
  } = {
    activated: isActivationEvent,
    activationThreshold: requiredDeposit,
    directCommission: null,
    overrideCommission: null,
    selfBonus: 0,
  }

  const activationId =
    options.activationId ??
    options.depositTransactionId ??
    `manual:${userId}:${(options.depositAt ?? new Date()).toISOString()}`

  const depositOccurredAt = options.depositAt ?? new Date()
  const depositReferenceId = options.depositTransactionId ?? activationId

  if (!options.dryRun) {
    const selfBonusAmount = roundCurrency(depositAmount * (SELF_BONUS_PCT / 100))
    const selfUniqueKey = `${toObjectIdString(userId)}|${depositReferenceId}|self5`

    const posted = await creditTeamReward({
      userId,
      amount: selfBonusAmount,
      occurredAt: depositOccurredAt,
      uniqueKey: selfUniqueKey,
      source: "self_deposit_bonus",
      meta: {
        depositAmount: roundCurrency(depositAmount),
        rewardPct: SELF_BONUS_PCT,
        depositTransactionId: options.depositTransactionId ?? null,
        activationId,
        qualifiesForActivation: isActivationEvent,
        label: "Self deposit bonus",
      },
      logContext: {
        level: "SELF",
        percentage: SELF_BONUS_PCT,
        base_amount: roundCurrency(depositAmount),
      },
    })

    if (posted === "posted") {
      results.selfBonus = selfBonusAmount
    }
  }

  // Mark active if needed
  if (qualifiesForActivation && !options.dryRun) {
    await User.updateOne({ _id: userId }, { $set: { isActive: true } })
  }

<<<<<<< HEAD
  // === NEW: Self-bonus 5% on every approved deposit ===
  const occurredAt = options.depositAt ?? new Date()
  const selfBonusAmount = roundCurrency(depositAmount * 0.05)
  const selfKey = `${toObjectIdString(userId)}|${options.depositTransactionId ?? `manual:${occurredAt.toISOString()}`}|self5`
=======
  if (isActivationEvent) {
    const existingDepositCredit = await Transaction.findOne({
      userId,
      type: "commission",
      "meta.source": "deposit_commission",
    })
>>>>>>> 540578136175f1417fd115e5232b0c4beebc12e7

  if (selfBonusAmount > 0) {
    if (!options.dryRun) {
      const existingSelf = await Transaction.findOne({
        userId,
        "meta.uniqueEventId": selfKey,
      })
      if (existingSelf) {
        console.info("[commission] duplicate_prevented", {
          event_id: selfKey,
          source: "self_deposit_bonus",
          level: "SELF",
          percentage: 5,
          base_amount: roundCurrency(depositAmount),
        })
      } else {
        await Balance.updateOne(
          { userId },
          {
            $inc: {
              current: selfBonusAmount,
              totalBalance: selfBonusAmount,
              totalEarning: selfBonusAmount,
            },
          },
          { upsert: true },
        )
        await Transaction.create({
          userId,
          type: "bonus",
          amount: selfBonusAmount,
          status: "approved",
          claimable: false, // goes straight to wallet, not claim queue
          meta: {
<<<<<<< HEAD
            source: "self_deposit_bonus",
            uniqueEventId: selfKey,
            depositAmount: roundCurrency(depositAmount),
            rewardPct: 5,
            depositTransactionId: options.depositTransactionId ?? null,
            qualifiesForActivation,
            policyVersion: POLICY_ADJUSTMENT_REASON,
            ...(options.adjustmentReason ? { adjustment_reason: options.adjustmentReason } : {}),
=======
            source: "deposit_commission",
            depositAmount: roundCurrency(depositAmount),
            fixedAmount: depositCommission,
            policyVersion: POLICY_ADJUSTMENT_REASON,
            ...(options.adjustmentReason ? { adjustment_reason: options.adjustmentReason } : {}),
            depositTransactionId: options.depositTransactionId ?? null,
            eventId: `deposit_commission:${userId}:${options.depositTransactionId ?? "manual"}`,
>>>>>>> 540578136175f1417fd115e5232b0c4beebc12e7
          },
          createdAt: occurredAt,
          updatedAt: occurredAt,
        })
        console.info("[commission] credit", {
          event_id: selfKey,
          source: "self_deposit_bonus",
          level: "SELF",
          percentage: 5,
          amount: selfBonusAmount,
          base_amount: roundCurrency(depositAmount),
        })
      }
    }
    results.selfBonus = selfBonusAmount
  }

<<<<<<< HEAD
  // === Direct & L2 (uses UPDATED processReferralCommission) ===
  results.directCommission = await processReferralCommission(
=======
  const directOutcome = await processReferralCommission(
>>>>>>> 540578136175f1417fd115e5232b0c4beebc12e7
    userId,
    depositAmount,
    settings,
    requiredDeposit,
    {
      depositTransactionId: options.depositTransactionId,
      depositAt: options.depositAt,
      adjustmentReason: options.adjustmentReason,
      dryRun: options.dryRun,
      qualifiesForActivation: isActivationEvent,
      activationId,
      forceActivation: options.forceActivation,
    },
  )

<<<<<<< HEAD
  // Level recompute
=======
  results.directCommission = directOutcome
  results.overrideCommission = directOutcome?.override ?? null

>>>>>>> 540578136175f1417fd115e5232b0c4beebc12e7
  if (!options.dryRun) {
    // Legacy level logic removed
  }

  return results
}

// ====== Team tree + stats (unchanged) ======

export async function buildTeamTree(userId: string, maxDepth = 5): Promise<any> {
  const userDoc = await User.findById(userId)
  if (!userDoc) return null

  const plainUser = toPlainObject<any>(userDoc)
  const baseUser: any = {
    _id: plainUser._id,
    name: plainUser.name,
    email: plainUser.email,
    referralCode: plainUser.referralCode,
    level: plainUser.level,
    depositTotal: plainUser.depositTotal,
    isActive: plainUser.isActive,
    qualified: hasQualifiedDeposit(plainUser),
    createdAt: plainUser.createdAt,
  }

  if (maxDepth <= 0) return baseUser

  const directReferrals = await User.find({ referredBy: userId })
    .select("name email referralCode level depositTotal isActive qualified createdAt")
    .sort({ createdAt: -1 })

  const children = []
  for (const referral of directReferrals) {
    const childTree = await buildTeamTree(toObjectIdString(referral._id), maxDepth - 1)
    if (childTree) children.push(childTree)
  }

  return {
    ...baseUser,
    children,
    directCount: directReferrals.length,
    activeCount: directReferrals.filter((r) => hasQualifiedDeposit(r)).length,
  }
}

export async function getTeamStats(userId: string) {
  const allTeamMembers = await getAllTeamMembers(userId)
  const totalMembers = allTeamMembers.length
  const activeMembers = allTeamMembers.filter((member) => hasQualifiedDeposit(member)).length
  const totalTeamDeposits = allTeamMembers.reduce((sum, member) => sum + member.depositTotal, 0)
  const totalTeamEarnings = allTeamMembers.reduce((sum, member) => sum + member.roiEarnedTotal, 0)

  const directReferrals = await User.find({ referredBy: userId })
    .select("qualified depositTotal")
    .lean()
  const directActive = directReferrals.filter((member) => hasQualifiedDeposit(member)).length

  return {
    totalMembers,
    activeMembers,
    directReferrals: directReferrals.length,
    directActive,
    totalTeamDeposits,
    totalTeamEarnings,
    levels: {
      level1: directReferrals.length,
      level2: await User.countDocuments({ referredBy: { $in: directReferrals.map((r) => r._id) } }),
    },
  }
}

async function getAllTeamMembers(userId: string, visited = new Set()): Promise<any[]> {
  if (visited.has(userId)) return []
  visited.add(userId)

  const directReferrals = await User.find({ referredBy: userId })
  let allMembers = [...directReferrals]
  for (const referral of directReferrals) {
    const subTeam = await getAllTeamMembers(toObjectIdString(referral._id), visited)
    allMembers = allMembers.concat(subTeam)
  }
  return allMembers
}
