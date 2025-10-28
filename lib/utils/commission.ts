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
const SELF_BONUS_PCT = 5
const DIRECT_REFERRAL_PCT = 15
const LEVEL2_OVERRIDE_PCT = 3
const FIRST_DEPOSIT_COMMISSION_AMOUNT = 2
const POLICY_ADJUSTMENT_REASON = "policy_update_20240601"
const PLATFORM_DECIMALS = 4

const LEVEL_THRESHOLDS = LEVEL_PROGRESS_REQUIREMENTS
export const LEVEL_PROGRESSION_THRESHOLDS = LEVEL_THRESHOLDS

function toObjectIdString(id: unknown): string {
  if (id instanceof mongoose.Types.ObjectId) {
    return id.toString()
  }

  if (typeof id === "string") {
    return id
  }

  if (id && typeof (id as { toString: () => string }).toString === "function") {
    return (id as { toString: () => string }).toString()
  }

  throw new Error("Invalid ObjectId value")
}

function resolveMinRewardDeposit(settings?: ISettings | null): number {
  const configuredMin = settings?.gating?.activeMinDeposit ?? MIN_DEPOSIT_FOR_REWARDS
  return Math.max(configuredMin, MIN_DEPOSIT_FOR_REWARDS)
}

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

async function detectReferralCycle(
  startingUser: any,
  maxDepth = 10,
): Promise<{ detected: boolean; path: string[] }> {
  if (!startingUser) {
    return { detected: false, path: [] }
  }

  const visited = new Set<string>()
  let current: any | null = startingUser
  let depth = 0
  const path: string[] = []

  while (current && depth < maxDepth) {
    const currentId = toObjectIdString(current._id)
    path.push(currentId)

    if (visited.has(currentId)) {
      return { detected: true, path }
    }

    visited.add(currentId)

    if (!current.referredBy) {
      return { detected: false, path }
    }

    const sponsorIdString = toObjectIdString(current.referredBy)

    if (visited.has(sponsorIdString)) {
      path.push(sponsorIdString)
      return { detected: true, path }
    }

    const sponsor = await User.findById(sponsorIdString)
    if (!sponsor) {
      return { detected: false, path }
    }

    current = sponsor
    depth += 1
  }

  return { detected: false, path }
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
      accrual: true,
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

function toPlainObject<T = any>(doc: any): T {
  if (!doc) {
    return doc as T
  }

  if (typeof doc.toObject === "function") {
    return doc.toObject() as T
  }

  if (typeof doc === "object") {
    return { ...(doc as Record<string, unknown>) } as T
  }

  return doc as T
}

interface QualificationEvent {
  achievedAt: Date
}

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
    if (currentLevel >= LEVEL_THRESHOLDS.length) {
      break
    }

    progressTowardNext += 1
    const requiredForNext = LEVEL_THRESHOLDS[currentLevel]

    if (progressTowardNext >= requiredForNext) {
      currentLevel += 1
      achievements.push({ level: currentLevel, achievedAt: event.achievedAt })
      progressTowardNext = 0
    }
  }

  if (currentLevel >= LEVEL_THRESHOLDS.length) {
    progressTowardNext = 0
  }

  return {
    level: currentLevel,
    progressTowardNext,
    totalActiveDirects: sortedEvents.length,
    achievements,
  }
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
  if (commissionRuleCache.has(level)) {
    return commissionRuleCache.get(level) ?? null
  }

  const rule = await CommissionRule.findOne({ level })
  if (rule) {
    commissionRuleCache.set(level, rule)
  }
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
    case 1:
      return "A"
    case 2:
      return "B"
    case 3:
      return "C"
    case 4:
      return "D"
    default:
      return null
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
    if (!rule || !Array.isArray(rule.teamOverrides) || rule.teamOverrides.length === 0) {
      continue
    }

    for (const override of rule.teamOverrides) {
      if (override.appliesTo !== "profit" || override.depth !== depth || override.team !== team) {
        continue
      }

      const amount = roundCurrency((profitAmount * override.pct) / 100)
      if (amount <= 0) {
        continue
      }

      payouts.push({ sponsor, sponsorLevel, override, team, depth, amount, kind: override.kind })
    }
  }

  return payouts
}

interface CalculateUserLevelOptions {
  persist?: boolean
  notify?: boolean
}

export async function calculateUserLevel(
  _userId: string,
  _options: CalculateUserLevelOptions = {},
): Promise<number> {
  return 0
}

interface RecalculateUserLevelsOptions extends CalculateUserLevelOptions {
  syncActiveFlags?: boolean
}

export async function recalculateAllUserLevels(_options: RecalculateUserLevelsOptions = {}) {
  return { updated: 0 }
}

interface ReferralChainEntry {
  level: number
  user: any
}

async function buildReferralChain(startingUser: any, maxLevels: number): Promise<ReferralChainEntry[]> {
  const chain: ReferralChainEntry[] = []
  let current: any = startingUser

  for (let level = 1; level <= maxLevels; level++) {
    const sponsorId = current?.referredBy
    if (!sponsorId) {
      break
    }

    const sponsor = await User.findById(sponsorId)
    if (!sponsor) {
      break
    }

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

  const referredUserIdString = toObjectIdString(referredUser._id)
  const sponsorIdString = toObjectIdString(payout.sponsor._id)

  if (sponsorIdString === referredUserIdString) {
    console.info("[commission] referral_cycle_self", {
      event_id: options.activationId ?? options.depositTransactionId ?? "manual",
      referredUserId: referredUserIdString,
      sponsorId: sponsorIdString,
    })
    return null
  }

  const lineageCheck = await detectReferralCycle(referredUser)
  if (lineageCheck.detected) {
    console.info("[commission] referral_cycle_detected", {
      event_id: options.activationId ?? options.depositTransactionId ?? "manual",
      path: lineageCheck.path,
    })
    return null
  }

  const activationId =
    options.activationId ??
    options.depositTransactionId ??
    `manual:${referredUserId}:${occurredAt.toISOString()}`
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
      source: "direct_referral",
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
  }

  if (overrideDetail) {
    const overrideSponsorId = toObjectIdString(overrideDetail.sponsor._id)
    const overrideUniqueKey = `${overrideSponsorId}|${activationId}|L2_3`

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
  return []
}

interface PolicyRecalculateOptions {
  dryRun?: boolean
  adjustmentReason?: string
}

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

    const currentLevel = await calculateUserLevel(sponsorId, {
      persist: false,
      notify: false,
    })
    const rule = await getCommissionRuleForLevel(currentLevel)
    if (!rule || !Array.isArray(rule.monthlyBonuses) || rule.monthlyBonuses.length === 0) {
      continue
    }

    for (const bonusRule of rule.monthlyBonuses) {
      if (salesEntry.total < bonusRule.threshold) continue

      const key = `${sponsorId}::${bonusRule.type}`
      const existing = existingBonusMap.get(key)
      const alreadyPaid = existing?.amount ? roundCurrency(existing.amount) : 0
      const delta = roundCurrency(bonusRule.amount - alreadyPaid)
      if (delta <= 0) {
        continue
      }

      const action: MonthlyBonusPayoutResult["action"] = alreadyPaid > 0 ? "adjusted" : options.dryRun ? "calculated" : "awarded"

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

      if (options.dryRun) {
        continue
      }

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

interface PolicyAdjustmentOptions extends PolicyRecalculateOptions {
  start?: Date
  end?: Date
}

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
  return [] as PolicyAdjustmentResult[]
}

export const policy_apply_retroactive_adjustments = policyApplyRetroactiveAdjustments

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
  const [settings, userDoc] = await Promise.all([
    Settings.findOne(),
    User.findById(userId),
  ])
  const requiredDeposit = resolveMinRewardDeposit(settings)
  const qualifiesForActivation = Boolean(
    userDoc && !userDoc.isActive && userDoc.depositTotal >= requiredDeposit,
  )
  const isActivationEvent = Boolean(qualifiesForActivation || options.forceActivation)

  const updatedDepositTotal = Number(userDoc?.depositTotal ?? 0)
  const qualifiesForDirectActivation = updatedDepositTotal >= QUALIFYING_DIRECT_DEPOSIT
  const newlyQualified = qualifiesForDirectActivation && Boolean(userDoc) && !Boolean(userDoc?.qualified)
  const sponsorId = userDoc?.referredBy ? userDoc.referredBy.toString() : null

  if (newlyQualified && !options.dryRun) {
    const qualifiedAt = options.depositAt ?? new Date()
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          qualified: true,
          qualifiedAt,
        },
      },
    )
  } else if (
    qualifiesForDirectActivation &&
    userDoc?.qualified &&
    !userDoc?.qualifiedAt &&
    !options.dryRun
  ) {
    const qualifiedAt = options.depositAt ?? new Date()
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          qualifiedAt,
        },
      },
    )
  }

  const results: {
    depositCommission?: number
    directCommission?: DirectCommissionResult | null
    overrideCommission?: OverrideCommissionDetail | null
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

    const userObjectId = toObjectId(userId)
    const existingSelfBonus = await Transaction.findOne({
      userId: userObjectId,
      "meta.uniqueEventId": selfUniqueKey,
    })

    if (existingSelfBonus) {
      console.info("[commission] duplicate_prevented", {
        event_id: selfUniqueKey,
        source: "self_deposit_bonus",
        amount: selfBonusAmount,
      })
    } else if (selfBonusAmount > 0) {
      await Balance.findOneAndUpdate(
        { userId: userObjectId },
        {
          $inc: {
            current: selfBonusAmount,
            totalBalance: selfBonusAmount,
            totalEarning: selfBonusAmount,
          },
          $setOnInsert: {
            current: 0,
            totalBalance: 0,
            totalEarning: 0,
            lockedCapital: 0,
            lockedCapitalLots: [],
            staked: 0,
            pendingWithdraw: 0,
            teamRewardsAvailable: 0,
            teamRewardsClaimed: 0,
            luckyDrawCredits: 0,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )

      await Transaction.create({
        userId: userObjectId,
        type: "bonus",
        amount: selfBonusAmount,
        status: "approved",
        claimable: false,
        meta: {
          source: "self_deposit_bonus",
          rewardPct: SELF_BONUS_PCT,
          depositAmount: roundCurrency(depositAmount),
          depositTransactionId: options.depositTransactionId ?? null,
          activationId,
          qualifiesForActivation: isActivationEvent,
          label: "Self deposit bonus",
          uniqueEventId: selfUniqueKey,
          uniqueKey: selfUniqueKey,
          eventId: selfUniqueKey,
        },
        createdAt: depositOccurredAt,
        updatedAt: depositOccurredAt,
      })

      console.info("[commission] credit", {
        event_id: selfUniqueKey,
        source: "self_deposit_bonus",
        amount: selfBonusAmount,
      })

      results.selfBonus = selfBonusAmount
    }
  }

  if (qualifiesForActivation && !options.dryRun) {
    await User.updateOne({ _id: userId }, { $set: { isActive: true } })
  }

  if (isActivationEvent) {
    const depositCommissionUniqueKey = `${toObjectIdString(userId)}|${depositReferenceId}|deposit2`

    const existingDepositCredit = await Transaction.findOne({
      userId: toObjectId(userId),
      "meta.uniqueEventId": depositCommissionUniqueKey,
    })

    if (!existingDepositCredit) {
      const depositCommission = roundCurrency(FIRST_DEPOSIT_COMMISSION_AMOUNT)
      results.depositCommission = depositCommission

      if (depositCommission > 0 && !options.dryRun) {
        await Balance.updateOne(
          { userId: toObjectId(userId) },
          {
            $inc: {
              current: depositCommission,
              totalBalance: depositCommission,
              totalEarning: depositCommission,
            },
          },
          { upsert: true },
        )

        await Transaction.create({
          userId: toObjectId(userId),
          type: "commission",
          amount: depositCommission,
          meta: {
            source: "deposit_commission",
            depositAmount: roundCurrency(depositAmount),
            fixedAmount: depositCommission,
            policyVersion: POLICY_ADJUSTMENT_REASON,
            ...(options.adjustmentReason ? { adjustment_reason: options.adjustmentReason } : {}),
            depositTransactionId: options.depositTransactionId ?? null,
            eventId: `deposit_commission:${userId}:${options.depositTransactionId ?? "manual"}`,
            uniqueEventId: depositCommissionUniqueKey,
            uniqueKey: depositCommissionUniqueKey,
          },
        })
      }
    } else {
      results.depositCommission = 0
      console.info("[commission] duplicate_prevented", {
        event_id: depositCommissionUniqueKey,
        source: "deposit_commission",
        amount: Number(existingDepositCredit.amount ?? 0),
      })
    }
  }

  const directOutcome = await processReferralCommission(
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

  results.directCommission = directOutcome
  results.overrideCommission = directOutcome?.override ?? null

  if (!options.dryRun) {
    // Legacy level logic removed
  }

  return results
}

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
    if (childTree) {
      children.push(childTree)
    }
  }

  return {
    ...baseUser,
    children,
    directCount: directReferrals.length,
    activeCount: directReferrals.filter((r) => hasQualifiedDeposit(r)).length,
  }
}

export async function getTeamStats(userId: string) {
  // Get all descendants (team members)
  const allTeamMembers = await getAllTeamMembers(userId)

  // Calculate team statistics
  const totalMembers = allTeamMembers.length
  const activeMembers = allTeamMembers.filter((member) => hasQualifiedDeposit(member)).length
  const totalTeamDeposits = allTeamMembers.reduce((sum, member) => sum + member.depositTotal, 0)
  const totalTeamEarnings = allTeamMembers.reduce((sum, member) => sum + member.roiEarnedTotal, 0)

  // Get direct referrals
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
      // Could expand to more levels as needed
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
