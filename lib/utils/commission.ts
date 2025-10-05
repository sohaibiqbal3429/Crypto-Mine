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

const MIN_DEPOSIT_FOR_REWARDS = 80
const DEPOSIT_COMMISSION_PCT = 0.02
const POLICY_ADJUSTMENT_REASON = "policy_update_20240501"

function resolveMinRewardDeposit(settings?: ISettings | null): number {
  const configuredMin = settings?.gating?.activeMinDeposit ?? MIN_DEPOSIT_FOR_REWARDS
  return Math.max(configuredMin, MIN_DEPOSIT_FOR_REWARDS)
}

function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100
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
  rule: ICommissionRule
  amount: number
}

async function resolveDirectCommission(
  referredUser: any,
  depositAmount: number,
  options: { persistLevel?: boolean } = {},
): Promise<DirectCommissionComputation | null> {
  const sponsorId = referredUser?.referredBy
  if (!sponsorId) return null

  const sponsor = await User.findById(sponsorId)
  if (!sponsor) return null

  const shouldPersist = options.persistLevel ?? true
  const sponsorLevel = await calculateUserLevel(sponsor._id.toString(), {
    persist: shouldPersist,
    notify: shouldPersist,
  })
  const rule = await getCommissionRuleForLevel(sponsorLevel)
  if (!rule || rule.directPct <= 0) return null

  const amount = roundCurrency((depositAmount * rule.directPct) / 100)
  if (amount <= 0) return null

  return { sponsor, sponsorLevel, rule, amount }
}

interface TeamOverridePayout {
  sponsor: any
  sponsorLevel: number
  override: TeamOverrideRule
  team: CommissionTeamCode
  depth: number
  amount: number
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

    const sponsorLevel = await calculateUserLevel(sponsor._id.toString(), {
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

      payouts.push({ sponsor, sponsorLevel, override, team, depth, amount })
    }
  }

  return payouts
}

interface CalculateUserLevelOptions {
  persist?: boolean
  notify?: boolean
}

export async function calculateUserLevel(
  userId: string,
  options: CalculateUserLevelOptions = {},
): Promise<number> {
  const [user, settings, directReferrals] = await Promise.all([
    User.findById(userId),
    Settings.findOne(),
    User.find({ referredBy: userId }).select("depositTotal"),
  ])

  if (!user) return 0

  const minDeposit = settings?.gating?.minDeposit ?? 30
  const activeDepositThreshold = settings?.gating?.activeMinDeposit ?? 80

  if (user.depositTotal < minDeposit) {
    if (user.level !== 0) {
      await User.updateOne({ _id: userId }, { level: 0 })
    }
    return 0
  }

  const activeDirectReferrals = directReferrals.filter((member) => member.depositTotal >= activeDepositThreshold)
  const activeCount = activeDirectReferrals.length
  const directSalesVolume = directReferrals.reduce((sum, member) => sum + member.depositTotal, 0)

  const rules = await CommissionRule.find().sort({ level: 1 })

  let userLevel = 1
  for (const rule of rules) {
    if (activeCount >= rule.activeMin) {
      userLevel = rule.level
    } else {
      break
    }
  }

  if (userLevel >= 5 && activeCount < 35) {
    userLevel = 4
  }

  if (userLevel >= 5 && directSalesVolume < 7000) {
    userLevel = 4
  }

  const shouldPersist = options.persist ?? true
  const shouldNotify = options.notify ?? true

  if (shouldPersist && user.level !== userLevel) {
    await User.updateOne({ _id: userId }, { level: userLevel })

    if (shouldNotify && userLevel > user.level) {
      await Notification.create({
        userId,
        kind: "level-up",
        title: "Level Up!",
        body: `Congratulations! You've reached Level ${userLevel}`,
      })
    }
  }

  return userLevel
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
}

export async function processReferralCommission(
  referredUserId: string,
  depositAmount: number,
  settings?: ISettings | null,
  minRewardDeposit?: number,
  options: ReferralCommissionOptions = {},
) {
  const referredUser = await User.findById(referredUserId)
  if (!referredUser) return null

  const resolvedSettings = settings ?? (await Settings.findOne())
  const requiredDeposit = minRewardDeposit ?? resolveMinRewardDeposit(resolvedSettings)

  const qualifiesForRewards =
    depositAmount >= requiredDeposit || Boolean(options.qualifiesForActivation)

  if (!qualifiesForRewards) return null

  const payout = await resolveDirectCommission(referredUser, depositAmount)
  if (!payout) return null

  if (options.dryRun) {
    return payout
  }

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
    meta: {
      source: "direct_referral",
      referredUserId,
      referredUserName: referredUser.name ?? null,
      depositAmount,
      commissionPct: payout.rule.directPct,
      sponsorLevel: payout.sponsorLevel,
      depositTransactionId: options.depositTransactionId ?? null,
      policyVersion: POLICY_ADJUSTMENT_REASON,
      ...(options.adjustmentReason ? { adjustment_reason: options.adjustmentReason } : {}),
    },
  })

  await Notification.create({
    userId: payout.sponsor._id,
    kind: "referral-joined",
    title: "Referral Commission Earned",
    body: `You earned $${payout.amount.toFixed(2)} commission from ${referredUser.name}'s deposit`,
  })

  if (resolvedSettings && depositAmount >= resolvedSettings.joiningBonus.threshold) {
    const bonusAmount = roundCurrency((depositAmount * resolvedSettings.joiningBonus.pct) / 100)
    if (bonusAmount > 0) {
      await Balance.updateOne(
        { userId: referredUserId },
        {
          $inc: {
            current: bonusAmount,
            totalBalance: bonusAmount,
            totalEarning: bonusAmount,
          },
        },
        { upsert: true },
      )

      await Transaction.create({
        userId: referredUserId,
        type: "bonus",
        amount: bonusAmount,
        meta: {
          source: "joining_bonus",
          depositAmount,
          bonusPct: resolvedSettings.joiningBonus.pct,
        },
      })
    }
  }

  return payout
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
  earningUserId: string,
  profitAmount: number,
  context: TeamOverrideContext = {},
) {
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

    if (context.dryRun) {
      continue
    }

    const baseMeta = {
      source: "team_override",
      payoutType: payout.override.payout,
      team: payout.team,
      depth: payout.depth,
      overridePct: payout.override.pct,
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
    sponsorMap.set(depositor._id.toString(), {
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
    entry.deposits.push(deposit._id.toString())
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
    const sponsorId = sponsor._id.toString()
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

type AdjustmentType = "direct_commission" | "team_commission" | "team_reward"

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
  options: PolicyAdjustmentOptions = {},
) {
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
      referredUser = await User.findById(userId).select("_id referredBy name")
      userCache.set(userId, referredUser)
    }
    if (!referredUser) continue

    const payout = await resolveDirectCommission(referredUser, deposit.amount ?? 0, {
      persistLevel: false,
    })
    if (!payout) continue

    const sponsorId = payout.sponsor._id.toString()

    const paidTransactions = await Transaction.find({
      userId: payout.sponsor._id,
      type: { $in: ["commission", "adjust"] },
      $or: [
        { "meta.depositTransactionId": deposit._id.toString() },
        {
          "meta.source": { $in: ["direct_referral", "direct_commission_adjustment"] },
          "meta.referredUserId": userId,
          "meta.depositAmount": deposit.amount,
        },
      ],
    })
      .select("amount")
      .lean()

    const alreadyPaid = roundCurrency(
      paidTransactions.reduce((sum, tx) => sum + (tx.amount ?? 0), 0),
    )
    const delta = roundCurrency(payout.amount - alreadyPaid)

    if (Math.abs(delta) <= 0) {
      continue
    }

    results.push({
      type: "direct_commission",
      userId: sponsorId,
      amount: delta,
      expected: payout.amount,
      previouslyPaid: alreadyPaid,
      referenceId: deposit._id.toString(),
      action: options.dryRun ? "calculated" : "adjusted",
    })

    if (options.dryRun) {
      continue
    }

    await Balance.updateOne(
      { userId: payout.sponsor._id },
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
      userId: payout.sponsor._id,
      type: "adjust",
      amount: delta,
      status: "approved",
      meta: {
        source: "direct_commission_adjustment",
        depositTransactionId: deposit._id.toString(),
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

  const profitIds = profitTransactions.map((tx) => tx._id.toString())
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
      profitTransactionId: profit._id.toString(),
      profitDate: profit.createdAt,
      profitSource: profit.meta?.source ?? "mining",
      baseAmount: profit.meta?.baseAmount,
    })

    if (!expectedOverrides.length) continue

    const existing = paymentsByProfit.get(profit._id.toString()) ?? []

    for (const payout of expectedOverrides) {
      const sponsorId = payout.sponsor._id.toString()
      const matchedPayments = existing.filter(
        (tx) =>
          tx.userId?.toString() === sponsorId &&
          tx.meta?.team === payout.team &&
          Number(tx.meta?.overridePct) === payout.override.pct &&
          tx.meta?.payoutType === payout.override.payout,
      )

      const alreadyPaid = roundCurrency(
        matchedPayments.reduce((sum, tx) => sum + (tx.amount ?? 0), 0),
      )
      const delta = roundCurrency(payout.amount - alreadyPaid)

      if (Math.abs(delta) <= 0) continue

      const type: AdjustmentType =
        payout.override.payout === "commission" ? "team_commission" : "team_reward"

      results.push({
        type,
        userId: sponsorId,
        amount: delta,
        expected: payout.amount,
        previouslyPaid: alreadyPaid,
        referenceId: profit._id.toString(),
        action: options.dryRun ? "calculated" : "adjusted",
      })

      if (options.dryRun) {
        continue
      }

      if (payout.override.payout === "commission") {
        await Balance.updateOne(
          { userId: payout.sponsor._id },
          {
            $inc: {
              current: delta,
              totalBalance: delta,
              totalEarning: delta,
            },
          },
          { upsert: true },
        )
      } else {
        await Balance.updateOne(
          { userId: payout.sponsor._id },
          {
            $inc: {
              teamRewardsAvailable: delta,
            },
          },
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
          profitTransactionId: profit._id.toString(),
          fromUserId: profit.userId.toString(),
          payoutType: payout.override.payout,
          team: payout.team,
          overridePct: payout.override.pct,
          expectedAmount: payout.amount,
          previouslyPaid: alreadyPaid,
          policyVersion: POLICY_ADJUSTMENT_REASON,
          adjustment_reason: adjustmentReason,
        },
      })
    }
  }

  return results
}

export const policy_apply_retroactive_adjustments = policyApplyRetroactiveAdjustments

interface DepositRewardOptions {
  depositTransactionId?: string
  depositAt?: Date
  adjustmentReason?: string
  dryRun?: boolean
}

export async function applyDepositRewards(
  userId: string,
  depositAmount: number,
  options: DepositRewardOptions = {},
) {
  const [settings, userDoc] = await Promise.all([
    Settings.findOne(),
    User.findById(userId).select("depositTotal isActive"),
  ])
  const requiredDeposit = resolveMinRewardDeposit(settings)
  const qualifiesForActivation = Boolean(
    userDoc && !userDoc.isActive && userDoc.depositTotal >= requiredDeposit,
  )
  const qualifiesForRewards = depositAmount >= requiredDeposit || qualifiesForActivation

  const results: {
    depositCommission?: number
    directCommission?: DirectCommissionComputation | null
    activated: boolean
    activationThreshold: number
  } = {
    activated: qualifiesForActivation,
    activationThreshold: requiredDeposit,
    directCommission: null,
  }

  if (qualifiesForActivation && !options.dryRun) {
    await User.updateOne({ _id: userId }, { $set: { isActive: true } })
  }

  if (qualifiesForRewards) {
    const depositCommission = roundCurrency(depositAmount * DEPOSIT_COMMISSION_PCT)
    results.depositCommission = depositCommission

    if (depositCommission > 0 && !options.dryRun) {
      await Balance.updateOne(
        { userId },
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
        userId,
        type: "commission",
        amount: depositCommission,
        meta: {
          source: "deposit_commission",
          depositAmount,
          commissionPct: DEPOSIT_COMMISSION_PCT * 100,
          policyVersion: POLICY_ADJUSTMENT_REASON,
          ...(options.adjustmentReason ? { adjustment_reason: options.adjustmentReason } : {}),
          depositTransactionId: options.depositTransactionId ?? null,
        },
      })
    }
  }

  results.directCommission = await processReferralCommission(
    userId,
    depositAmount,
    settings,
    requiredDeposit,
    {
      depositTransactionId: options.depositTransactionId,
      depositAt: options.depositAt,
      adjustmentReason: options.adjustmentReason,
      dryRun: options.dryRun,
      qualifiesForActivation,
    },
  )

  if (!options.dryRun) {
    await calculateUserLevel(userId)
  }

  return results
}

export async function buildTeamTree(userId: string, maxDepth = 5): Promise<any> {
  const user = await User.findById(userId).select("name email referralCode level depositTotal isActive createdAt")
  if (!user) return null

  if (maxDepth <= 0) return user

  const directReferrals = await User.find({ referredBy: userId })
    .select("name email referralCode level depositTotal isActive createdAt")
    .sort({ createdAt: -1 })

  const children = []
  for (const referral of directReferrals) {
    const childTree = await buildTeamTree(referral._id.toString(), maxDepth - 1)
    if (childTree) {
      children.push(childTree)
    }
  }

  return {
    ...user.toObject(),
    children,
    directCount: directReferrals.length,
    activeCount: directReferrals.filter((r) => r.depositTotal >= 80).length,
  }
}

export async function getTeamStats(userId: string) {
  // Get all descendants (team members)
  const allTeamMembers = await getAllTeamMembers(userId)

  // Calculate team statistics
  const totalMembers = allTeamMembers.length
  const activeMembers = allTeamMembers.filter((member) => member.depositTotal >= 80).length
  const totalTeamDeposits = allTeamMembers.reduce((sum, member) => sum + member.depositTotal, 0)
  const totalTeamEarnings = allTeamMembers.reduce((sum, member) => sum + member.roiEarnedTotal, 0)

  // Get direct referrals
  const directReferrals = await User.find({ referredBy: userId })
  const directActive = directReferrals.filter((member) => member.depositTotal >= 80).length

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
    const subTeam = await getAllTeamMembers(referral._id.toString(), visited)
    allMembers = allMembers.concat(subTeam)
  }

  return allMembers
}
