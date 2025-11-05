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
  percent: number
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

export async function previewTeamEarnings(userId: string): Promise<TeamRewardsPreview> {
  const [pendingRaw, claimedRaw] = await Promise.all([
    getPendingTeamEarnings(userId),
    BonusPayout.find({
      receiverUserId: new mongoose.Types.ObjectId(userId),
      status: "CLAIMED",
      type: { $in: TEAM_EARNING_TYPES },
    })
      .select({ payoutAmount: 1, claimedAt: 1 })
      .lean(),
  ])

  const payerIds = Array.from(new Set(pendingRaw.map((entry) => entry.payerUserId)))
  const payerLookup = await fetchUserLookup(payerIds)

  const pending = pendingRaw.map<PendingTeamEarning>((entry) => ({
    id: entry.id,
    type: entry.type as TeamEarningType,
    amount: entry.payoutAmount,
    percent: entry.percent,
    baseAmount: entry.baseAmount,
    createdAt: entry.createdAt,
    sourceTxId: entry.sourceTxId,
    payer: payerLookup[entry.payerUserId] ?? null,
  }))

  const available = pending.reduce((total, entry) => total + entry.amount, 0)
  let claimedTotal = 0
  let lastClaimedAt: Date | null = null

  for (const entry of claimedRaw) {
    const amount = Number(entry.payoutAmount ?? 0)
    claimedTotal += amount
    const claimedAt = entry.claimedAt instanceof Date ? entry.claimedAt : null
    if (claimedAt && (!lastClaimedAt || claimedAt > lastClaimedAt)) {
      lastClaimedAt = claimedAt
    }
  }

  return { available, claimedTotal, lastClaimedAt, pending }
}

export interface ClaimTeamRewardsResult {
  claimed: number
  items: ClaimedTeamEarning[]
  claimedTotal: number
  lastClaimedAt: Date | null
}

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
    percent: item.percent,
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
    percent: entry.percent,
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
