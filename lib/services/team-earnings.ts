import mongoose from "mongoose"

import Balance from "@/models/Balance"
import CommissionRule, { type CommissionTeamCode } from "@/models/CommissionRule"
import Transaction, { type ITransaction } from "@/models/Transaction"
import Notification from "@/models/Notification"
import { calculateUserLevel } from "@/lib/utils/commission"

function normalizeUserId(id: string | mongoose.Types.ObjectId): string {
  return typeof id === "string" ? id : id.toString()
}

function toObjectId(id: string | mongoose.Types.ObjectId): mongoose.Types.ObjectId {
  if (id instanceof mongoose.Types.ObjectId) {
    return id
  }

  if (typeof id === "string" && mongoose.Types.ObjectId.isValid(id)) {
    return new mongoose.Types.ObjectId(id)
  }

  throw new Error("Invalid ObjectId value")
}

function roundPlatform(amount: number): number {
  return Math.round(amount * 10000) / 10000
}

function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100
}

interface RewardCoverageDetail {
  team: CommissionTeamCode
  rate: number
}

interface RewardProfile {
  level: number
  rate: number
  coverage: CommissionTeamCode[]
  coverageDetails: RewardCoverageDetail[]
}

interface TeamRewardsPreview {
  available: number
  claimedTotal: number
  lastClaimedAt: Date | null
  level: number
  rate: number
  coverage: CommissionTeamCode[]
  coverageDetails: RewardCoverageDetail[]
  windowStart: Date | null
  windowEnd: Date
  dgpCount: number
  totalDgp: number
}

interface ClaimResult extends TeamRewardsPreview {
  claimed: number
  message?: string
}

function buildClaimableRewardsQuery(userId: string) {
  const userIdString = normalizeUserId(userId)
  const candidates: (string | mongoose.Types.ObjectId)[] = [userIdString]
  if (mongoose.Types.ObjectId.isValid(userIdString)) {
    candidates.push(new mongoose.Types.ObjectId(userIdString))
  }
  return Transaction.find({
    userId: { $in: candidates },
    type: "teamReward",
    status: "approved",
    claimable: true,
  }).sort({ createdAt: 1, _id: 1 })
}

export async function getClaimableTeamRewardTotal(userId: string): Promise<number> {
  const claimable = await buildClaimableRewardsQuery(userId).select({ amount: 1 }).lean()
  const total = claimable.reduce((sum, tx) => sum + Number(tx?.amount ?? 0), 0)
  return roundPlatform(total)
}

export type RewardHistoryCategory =
  | "claim"
  | "team_reward"
  | "team_commission"
  | "daily_profit"
  | "daily_team_earning"
  | "deposit_commission"
  | "bonus"
  | "salary"
  | "other"

export interface RewardHistoryEntry {
  id: string
  occurredAt: Date
  amount: number
  status: string
  category: RewardHistoryCategory
  description: string
  team: CommissionTeamCode | null
  teams: CommissionTeamCode[] | null
  rate: number | null
  level: number | null
  sourceUserId: string | null
  sourceUserName: string | null
  transactionType: ITransaction["type"]
  baseAmount: number | null
}

async function resolveRewardProfile(level: number): Promise<RewardProfile> {
  if (level <= 0) {
    return { level, rate: 0, coverage: [], coverageDetails: [] }
  }

  const ruleDoc = await CommissionRule.findOne({ level }).lean()
  if (!ruleDoc) {
    return { level, rate: 0, coverage: [], coverageDetails: [] }
  }

  const rewardOverrides = (ruleDoc.teamOverrides ?? []).filter((override) => override.payout === "reward")

  if (rewardOverrides.length === 0) {
    return { level: ruleDoc.level, rate: 0, coverage: [], coverageDetails: [] }
  }

  const coverageDetails: RewardCoverageDetail[] = rewardOverrides.map((override) => ({
    team: override.team,
    rate: override.pct,
  }))

  const uniqueTeams = Array.from(new Set(coverageDetails.map((detail) => detail.team)))
  const nominalRate = coverageDetails.length > 0 ? coverageDetails[0]!.rate / 100 : 0

  return {
    level: ruleDoc.level,
    rate: nominalRate,
    coverage: uniqueTeams,
    coverageDetails,
  }
}

async function loadBalance(userId: string, session?: mongoose.ClientSession) {
  const query = Balance.findOne({ userId: normalizeUserId(userId) })
  if (session && typeof (query as any).session === "function") {
    query.session(session)
  }
  const balance = await query
  if (!balance) {
    throw new Error("Balance not found")
  }
  return balance
}

export async function previewTeamEarnings(userId: string, now = new Date()): Promise<TeamRewardsPreview> {
  const [level, balance, available] = await Promise.all([
    calculateUserLevel(userId, { persist: false, notify: false }),
    Balance.findOne({ userId: normalizeUserId(userId) }),
    getClaimableTeamRewardTotal(userId),
  ])

  const rewardProfile = await resolveRewardProfile(level)

  const claimedTotal = roundCurrency(balance?.teamRewardsClaimed ?? 0)
  const lastClaimedAt = balance?.teamRewardsLastClaimedAt ?? null

  return {
    available,
    claimedTotal,
    lastClaimedAt,
    level: rewardProfile.level,
    rate: rewardProfile.rate,
    coverage: rewardProfile.coverage,
    coverageDetails: rewardProfile.coverageDetails,
    windowStart: lastClaimedAt,
    windowEnd: now,
    dgpCount: 0,
    totalDgp: 0,
  }
}

export async function claimTeamEarnings(userId: string, now = new Date()): Promise<ClaimResult> {
  let session: mongoose.ClientSession | null = null
  let result: ClaimResult | null = null

  const executeClaim = async (activeSession?: mongoose.ClientSession) => {
    const [level, balance, claimableTransactions] = await Promise.all([
      calculateUserLevel(userId, { persist: false, notify: false }),
      loadBalance(userId, activeSession),
      (async () => {
        const query = buildClaimableRewardsQuery(userId)
        if (activeSession && typeof (query as any).session === "function") {
          query.session(activeSession)
        }
        return query
      })(),
    ])

    const rewardProfile = await resolveRewardProfile(level)
    const claimableList = await claimableTransactions
    const totalClaimableRaw = claimableList.reduce((sum, tx) => sum + Number(tx.amount ?? 0), 0)
    const totalClaimable = roundPlatform(totalClaimableRaw)

    if (totalClaimable <= 0) {
      result = {
        available: 0,
        claimed: 0,
        claimedTotal: roundCurrency(balance.teamRewardsClaimed ?? 0),
        lastClaimedAt: balance.teamRewardsLastClaimedAt ?? null,
        level: rewardProfile.level,
        rate: rewardProfile.rate,
        coverage: rewardProfile.coverage,
        coverageDetails: rewardProfile.coverageDetails,
        windowStart: balance.teamRewardsLastClaimedAt ?? null,
        windowEnd: now,
        dgpCount: 0,
        totalDgp: 0,
        message: "No rewards available",
      }
      return
    }

    balance.current = roundPlatform((balance.current ?? 0) + totalClaimable)
    balance.totalBalance = roundPlatform((balance.totalBalance ?? 0) + totalClaimable)
    balance.totalEarning = roundPlatform((balance.totalEarning ?? 0) + totalClaimable)
    balance.teamRewardsClaimed = roundPlatform((balance.teamRewardsClaimed ?? 0) + totalClaimable)
    balance.teamRewardsAvailable = roundPlatform(
      Math.max(0, (balance.teamRewardsAvailable ?? 0) - totalClaimable),
    )
    balance.teamRewardsLastClaimedAt = now
    await balance.save(activeSession ? { session: activeSession } : undefined)

    const userObjectId = toObjectId(userId)
    const userIdString = normalizeUserId(userId)
    const createOptions: mongoose.SaveOptions | undefined = activeSession ? { session: activeSession } : undefined

    const transactionDoc = {
      userId: userIdString,
      type: "teamReward" as const,
      amount: totalClaimable,
      status: "approved" as const,
      meta: {
        source: "team_rewards_claim",
        level: rewardProfile.level,
        coverage: rewardProfile.coverageDetails,
        claimedAt: now.toISOString(),
        previousAvailable: totalClaimable,
        claimedEntryIds: claimableList.map((tx) => (tx._id as mongoose.Types.ObjectId).toString()),
      },
    }

    const claimableIds = claimableList.map((tx) => tx._id as mongoose.Types.ObjectId)

    const claimTransactionDoc = (await Transaction.create(
      {
        ...transactionDoc,
        claimable: false,
        createdAt: now,
        updatedAt: now,
      } as any,
      createOptions as any,
    )) as unknown as mongoose.Document & ITransaction
    const claimTransactionId = (claimTransactionDoc._id as mongoose.Types.ObjectId) ??
      new mongoose.Types.ObjectId((claimTransactionDoc as any).id)

    if (claimableIds.length > 0) {
      await Transaction.updateMany(
        { _id: { $in: claimableIds } },
        {
          $set: {
            claimable: false,
            claimedAt: now,
            "meta.claimTransactionId": claimTransactionId,
          },
        },
        activeSession ? { session: activeSession } : undefined,
      )
    }

    const notificationDoc = {
      userId: userObjectId,
      kind: "team-reward-claimed" as const,
      title: "Team rewards claimed",
      body: `You claimed $${totalClaimable.toFixed(4)} from your team rewards wallet.`,
    }

    await Notification.create(notificationDoc as any, activeSession ? { session: activeSession } : undefined)

    result = {
      available: 0,
      claimed: totalClaimable,
      claimedTotal: roundCurrency(balance.teamRewardsClaimed),
      lastClaimedAt: balance.teamRewardsLastClaimedAt ?? now,
      level: rewardProfile.level,
      rate: rewardProfile.rate,
      coverage: rewardProfile.coverage,
      coverageDetails: rewardProfile.coverageDetails,
      windowStart: balance.teamRewardsLastClaimedAt,
      windowEnd: now,
      dgpCount: 0,
      totalDgp: 0,
    }
  }

  await executeClaim()

  if (!result) {
    throw new Error("Failed to resolve team earnings claim result")
  }

  return result
}

function describeHistoryEntry(entry: RewardHistoryEntry): string {
  switch (entry.category) {
    case "claim":
      return "Claimed rewards"
    case "team_reward":
      return entry.sourceUserName
        ? `Team reward from ${entry.sourceUserName}`
        : entry.team
          ? `Team reward from Team ${entry.team}`
          : "Team reward"
    case "team_commission":
      return entry.sourceUserName
        ? `Team commission from ${entry.sourceUserName}`
        : entry.team
          ? `Team commission from Team ${entry.team}`
          : "Team commission"
    case "daily_team_earning": {
      const teamSummary =
        entry.teams && entry.teams.length > 0
          ? entry.teams.map((team) => `Team ${team}`).join(", ")
          : entry.team
            ? `Team ${entry.team}`
            : null
      return teamSummary ? `Daily team earning from ${teamSummary}` : "Daily team earning"
    }
    case "daily_profit":
      return entry.sourceUserName
        ? `Daily profit override from ${entry.sourceUserName}`
        : entry.team
          ? `Daily profit override from Team ${entry.team}`
          : "Daily profit override"
    case "deposit_commission":
      return entry.sourceUserName
        ? `Direct commission from ${entry.sourceUserName}`
        : "Direct commission"
    case "bonus":
      return entry.sourceUserName ? `Monthly bonus (${entry.sourceUserName})` : "Monthly bonus"
    case "salary":
      return entry.sourceUserName ? `Monthly salary (${entry.sourceUserName})` : "Monthly salary"
    default:
      return entry.sourceUserName ?? "Team activity"
  }
}

function inferHistoryCategory(tx: any): RewardHistoryCategory {
  const source = tx.meta?.source
  if (tx.type === "teamReward" && source === "team_rewards_claim") {
    return "claim"
  }

  if (tx.type === "bonus") {
    if (source === "team_override") {
      switch (tx.meta?.overrideKind) {
        case "team_reward":
          return "team_reward"
        case "team_commission":
          return "team_commission"
        case "daily_override":
          return "daily_profit"
        default:
          return "other"
      }
    }

    if (source === "monthly_policy_bonus") {
      return tx.meta?.bonusType === "salary" ? "salary" : "bonus"
    }

    if (source === "daily_override") {
      return "daily_profit"
    }
  }

  if (tx.type === "commission" && source === "direct_referral") {
    return "deposit_commission"
  }

  if (tx.type === "commission" && source === "activation_override") {
    return "team_commission"
  }

  if (tx.type === "teamReward" && source === "daily_team_earning") {
    return "daily_team_earning"
  }

  if (tx.type === "teamReward" && source === "daily_team_reward") {
    return "daily_profit"
  }

  if (tx.type === "teamReward") {
    if (source === "activation_direct") {
      return "deposit_commission"
    }

    if (source === "activation_level2_override") {
      return "team_commission"
    }

    if (source === "self_deposit_bonus") {
      return "other"
    }
  }

  return "other"
}

function toHistoryEntry(tx: any): RewardHistoryEntry {
  const category = inferHistoryCategory(tx)
  const rate =
    typeof tx.meta?.overridePct === "number"
      ? tx.meta.overridePct
      : typeof tx.meta?.commissionPct === "number"
        ? tx.meta.commissionPct
        : typeof tx.meta?.teamProfitPct === "number"
          ? tx.meta.teamProfitPct
          : null

  const baseAmount =
    typeof tx.meta?.baseProfit === "number"
      ? tx.meta.baseProfit
      : typeof tx.meta?.teamProfit === "number"
        ? tx.meta.teamProfit
        : null

  const teamsList = Array.isArray(tx.meta?.teams)
    ? (tx.meta.teams.filter((team: unknown): team is CommissionTeamCode =>
        typeof team === "string" && ["A", "B", "C", "D"].includes(team),
      ) as CommissionTeamCode[])
    : []

  const status = category === "daily_team_earning" ? "posted" : tx.status ?? "approved"

  const entry: RewardHistoryEntry = {
    id: tx._id.toString(),
    occurredAt: tx.createdAt instanceof Date ? tx.createdAt : new Date(tx.createdAt),
    amount: Number(tx.amount ?? 0),
    status,
    category,
    description: "",
    team: (tx.meta?.team as CommissionTeamCode | undefined) ?? null,
    teams: teamsList.length > 0 ? teamsList : null,
    rate,
    level:
      typeof tx.meta?.level === "number"
        ? tx.meta.level
        : typeof tx.meta?.sponsorLevel === "number"
          ? tx.meta.sponsorLevel
          : null,
    sourceUserId:
      typeof tx.meta?.fromUserId === "string"
        ? tx.meta.fromUserId
        : typeof tx.meta?.referredUserId === "string"
          ? tx.meta.referredUserId
          : null,
    sourceUserName:
      typeof tx.meta?.fromUserName === "string"
        ? tx.meta.fromUserName
        : typeof tx.meta?.referredUserName === "string"
          ? tx.meta.referredUserName
          : tx.meta?.label ?? tx.meta?.month ?? null,
    transactionType: tx.type,
    baseAmount: baseAmount !== null ? Number(baseAmount) : null,
  }

  entry.description = describeHistoryEntry(entry)

  return entry
}

interface ListHistoryOptions {
  limit?: number
}

export async function listTeamRewardHistory(
  userId: string,
  options: ListHistoryOptions = {},
): Promise<RewardHistoryEntry[]> {
  const limit = Math.max(1, Math.min(options.limit ?? 100, 200))
  const userIdString = normalizeUserId(userId)

  const transactions = await Transaction.find({
    userId: userIdString,
    $or: [
      { type: "teamReward" },
      { type: "bonus", "meta.source": { $in: ["team_override", "monthly_policy_bonus"] } },
      { type: "commission", "meta.source": "direct_referral" },
    ],
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean()

  return transactions.map((tx) => toHistoryEntry(tx))
}

