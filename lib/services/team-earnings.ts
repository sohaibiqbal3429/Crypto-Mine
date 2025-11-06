import mongoose from "mongoose"

import BonusPayout from "@/models/Payout"
import User from "@/models/User"
import Balance from "@/models/Balance"
import {
  claimTeamEarningPayouts,
  getPendingTeamEarnings,
  getClaimedTeamEarnings,
} from "@/lib/services/rewards"

const TEAM_EARNING_TYPES = ["TEAM_EARN_L1", "TEAM_EARN_L2"] as const

type TeamEarningType = (typeof TEAM_EARNING_TYPES)[number]

interface UserLookupEntry {
  id: string
  name: string | null
  email: string | null
}

async function fetchUserLookup(ids: string[]): Promise<Record<string, UserLookupEntry>> {
  if (ids.length === 0) return {}
  const objectIds = ids
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id))

  const users = await User.find({ _id: { $in: objectIds } })
    .select({ name: 1, email: 1 })
    .lean()

  const lookup: Record<string, UserLookupEntry> = {}
  for (const user of users) {
    const id = user._id?.toString()
    if (!id) continue
    lookup[id] = {
      id,
      name: typeof user.name === "string" ? user.name : null,
      email: typeof user.email === "string" ? user.email : null,
    }
  }
  return lookup
}

export interface PendingTeamEarning {
  id: string
  type: TeamEarningType
  amount: number
  percent: number     // percent as a whole number, e.g. 2 for 2%
  baseAmount: number
  createdAt: Date
  payer: UserLookupEntry | null
  sourceTxId: string
}

export interface ClaimedTeamEarning extends PendingTeamEarning {
  claimedAt: Date
}

export interface TeamRewardsPreview {
  available: number
  claimedTotal: number
  lastClaimedAt: Date | null
  pending: PendingTeamEarning[]
}

/**
 * Reads pending claimables and enriches with payer info.
 * Totals are taken from Balance as the primary source of truth (kept in sync by rewards service),
 * with a safe fallback to computed values if Balance is missing.
 */
export async function previewTeamEarnings(userId: string): Promise<TeamRewardsPreview> {
  const [pendingRaw, claimedRaw, balanceDoc] = await Promise.all([
    getPendingTeamEarnings(userId),
    BonusPayout.find({
      receiverUserId: new mongoose.Types.ObjectId(userId),
      status: "CLAIMED",
      type: { $in: TEAM_EARNING_TYPES },
    })
      .select({ payoutAmount: 1, claimedAt: 1 })
      .lean(),
    Balance.findOne({ userId: new mongoose.Types.ObjectId(userId) })
      .select({ teamRewardsAvailable: 1, teamRewardsClaimed: 1, teamRewardsLastClaimedAt: 1 })
      .lean(),
  ])

  const payerIds = Array.from(new Set(pendingRaw.map((entry) => entry.payerUserId)))
  const payerLookup = await fetchUserLookup(payerIds)

  const pending = pendingRaw.map<PendingTeamEarning>((entry) => ({
    id: entry.id,
    type: entry.type as TeamEarningType,
    amount: entry.payoutAmount,
    percent: entry.percent, // already in %
    baseAmount: entry.baseAmount,
    createdAt: entry.createdAt,
    sourceTxId: entry.sourceTxId,
    payer: payerLookup[entry.payerUserId] ?? null,
  }))

  // Prefer Balance fields (they are updated atomically when creating/claiming)
  const availableFromBalance = Number(balanceDoc?.teamRewardsAvailable ?? NaN)
  const claimedFromBalance = Number(balanceDoc?.teamRewardsClaimed ?? NaN)
  const lastClaimedAtFromBalance =
    balanceDoc?.teamRewardsLastClaimedAt instanceof Date
      ? balanceDoc.teamRewardsLastClaimedAt
      : null

  // Fallbacks if balance not initialized (e.g., legacy data)
  const availableFallback = pending.reduce((total, entry) => total + entry.amount, 0)
  let claimedFallback = 0
  let lastClaimedAtFallback: Date | null = null
  for (const entry of claimedRaw) {
    const amount = Number(entry.payoutAmount ?? 0)
    claimedFallback += amount
    const claimedAt = entry.claimedAt instanceof Date ? entry.claimedAt : null
    if (claimedAt && (!lastClaimedAtFallback || claimedAt > lastClaimedAtFallback)) {
      lastClaimedAtFallback = claimedAt
    }
  }

  const available = Number.isFinite(availableFromBalance) ? availableFromBalance : availableFallback
  const claimedTotal = Number.isFinite(claimedFromBalance) ? claimedFromBalance : claimedFallback
  const lastClaimedAt = lastClaimedAtFromBalance ?? lastClaimedAtFallback

  return { available, claimedTotal, lastClaimedAt, pending }
}

export interface ClaimTeamRewardsResult {
  claimed: number
  items: ClaimedTeamEarning[]
  claimedTotal: number
  lastClaimedAt: Date | null
}

/**
 * Claims all pending team earnings (L1 2% / L2 1%), credits wallet, writes history.
 * Idempotent via payout status transitions; totals returned align with Balance.
 */
export async function claimTeamEarnings(userId: string): Promise<ClaimTeamRewardsResult> {
  const outcome = await claimTeamEarningPayouts(userId)
  if (outcome.claimedCount === 0) {
    return { claimed: 0, items: [], claimedTotal: 0, lastClaimedAt: null }
  }

  const payerIds = Array.from(new Set(outcome.items.map((item) => item.payerUserId)))
  const payerLookup = await fetchUserLookup(payerIds)

  const items: ClaimedTeamEarning[] = outcome.items.map((item) => ({
    id: item.id,
    type: item.type as TeamEarningType,
    amount: item.amount,
    percent: item.percent, // already in %
    baseAmount: item.baseAmount,
    createdAt: item.createdAt,
    claimedAt: item.claimedAt,
    sourceTxId: item.sourceTxId,
    payer: payerLookup[item.payerUserId] ?? null,
  }))

  const claimedTotal = items.reduce((total, item) => total + item.amount, 0)
  const lastClaimedAt = items.reduce<Date | null>((latest, item) => {
    return !latest || item.claimedAt > latest ? item.claimedAt : latest
  }, null)

  return { claimed: outcome.claimedTotal, items, claimedTotal, lastClaimedAt }
}

export async function listTeamRewardHistory(userId: string): Promise<ClaimedTeamEarning[]> {
  const claimedRaw = await getClaimedTeamEarnings(userId)
  const payerIds = Array.from(new Set(claimedRaw.map((entry) => entry.payerUserId)))
  const payerLookup = await fetchUserLookup(payerIds)

  return claimedRaw.map<ClaimedTeamEarning>((entry) => ({
    id: entry.id,
    type: entry.type as TeamEarningType,
    amount: entry.payoutAmount,
    percent: entry.percent, // in %
    baseAmount: entry.baseAmount,
    createdAt: entry.createdAt,
    claimedAt: entry.claimedAt,
    sourceTxId: entry.sourceTxId,
    payer: payerLookup[entry.payerUserId] ?? null,
  }))
}

export async function getClaimableTeamRewardTotal(userId: string): Promise<number> {
  const pending = await getPendingTeamEarnings(userId)
  return pending.reduce((total, entry) => total + entry.payoutAmount, 0)
}

/**
 * One-shot reconciler to sync Balance counters with existing payouts.
 * Safe to run anytime (idempotent).
 */
export async function syncTeamRewardBalance(userId: string) {
  const [available, claimedTotal] = await Promise.all([
    getClaimableTeamRewardTotal(userId),
    BonusPayout.aggregate([
      {
        $match: {
          receiverUserId: new mongoose.Types.ObjectId(userId),
          status: "CLAIMED",
          type: { $in: TEAM_EARNING_TYPES },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$payoutAmount" },
        },
      },
    ]),
  ])

  const claimed = Number(claimedTotal[0]?.total ?? 0)

  await Balance.updateOne(
    { userId: new mongoose.Types.ObjectId(userId) },
    {
      $set: {
        teamRewardsAvailable: available,
        teamRewardsClaimed: claimed,
      },
    },
    { upsert: true },
  )
}
