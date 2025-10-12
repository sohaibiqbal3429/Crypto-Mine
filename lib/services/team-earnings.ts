import mongoose from "mongoose"

import Balance from "@/models/Balance"
import TeamDailyProfit from "@/models/TeamDailyProfit"
import TeamDailyClaim from "@/models/TeamDailyClaim"
import Transaction from "@/models/Transaction"
import Notification from "@/models/Notification"
import User from "@/models/User"
import { calculateUserLevel } from "@/lib/utils/commission"

type TeamCode = "A" | "B" | "C" | "D"

type TeamLayers = Record<TeamCode, string[]>

interface ComputeOptions {
  session?: mongoose.ClientSession
  levelOverride?: number
  now?: Date
}

interface CommissionProfile {
  level: number
  rate: number
  coverage: TeamCode[]
}

interface DgpComputationEntry {
  id: mongoose.Types.ObjectId
  profitDate: Date
  profitAmount: number
  commissionCents: number
  team: TeamCode
}

interface TeamEarningsComputation {
  balance: Awaited<ReturnType<typeof Balance.findOne>>
  windowStart: Date | null
  windowEnd: Date
  commissionProfile: CommissionProfile | null
  entries: DgpComputationEntry[]
  totalCommissionCents: number
  totalProfitAmount: number
  level: number
}

interface TeamEarningsPreview {
  available: number
  level: number
  rate: number
  coverage: TeamCode[]
  windowStart: Date | null
  windowEnd: Date
  dgpCount: number
  totalDgp: number
  claimedTotal: number
  lastClaimedAt: Date | null
}

interface ClaimResult {
  claimed: number
  level: number
  rate: number
  coverage: TeamCode[]
  windowStart: Date | null
  windowEnd: Date
  dgpCount: number
  totalDgp: number
  claimedTotal: number
  lastClaimedAt: Date | null
  message?: string
}

const TEAM_ORDER: TeamCode[] = ["A", "B", "C", "D"]

const EPSILON = 1e-8

function ensureObjectId(id: string | mongoose.Types.ObjectId): mongoose.Types.ObjectId {
  if (id instanceof mongoose.Types.ObjectId) {
    return id
  }

  if (typeof id === "string" && mongoose.Types.ObjectId.isValid(id)) {
    return new mongoose.Types.ObjectId(id)
  }

  throw new Error("Invalid ObjectId value")
}

function bankersRoundToCents(amount: number): number {
  const scaled = amount * 100
  const floor = Math.floor(scaled)
  const diff = scaled - floor

  if (Math.abs(diff - 0.5) < EPSILON) {
    return floor % 2 === 0 ? floor : floor + 1
  }

  return Math.round(scaled)
}

function computeWindowEnd(now: Date): Date {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  end.setUTCDate(end.getUTCDate() - 1)
  end.setUTCHours(23, 59, 59, 999)
  return end
}

function resolveCommissionProfile(level: number): CommissionProfile | null {
  if (level >= 5) {
    return { level, rate: 0.02, coverage: TEAM_ORDER }
  }
  if (level >= 4) {
    return { level, rate: 0.02, coverage: TEAM_ORDER }
  }
  if (level >= 3) {
    return { level, rate: 0.02, coverage: TEAM_ORDER }
  }
  if (level === 2) {
    return { level, rate: 0.01, coverage: ["A", "B", "C"] }
  }
  if (level === 1) {
    return { level, rate: 0.01, coverage: ["A"] }
  }
  return null
}

async function buildTeamLayers(
  userId: string,
  options: { session?: mongoose.ClientSession } = {},
): Promise<TeamLayers> {
  const session = options.session
  const toObjectId = (id: string) => new mongoose.Types.ObjectId(id)

  const result: TeamLayers = { A: [], B: [], C: [], D: [] }

  const teamAUsers = await User.find({ referredBy: ensureObjectId(userId) })
    .select("_id")
    .session(session ?? null)
  const teamAIds = teamAUsers.map((doc) => doc._id.toString())
  result.A = teamAIds

  const teamBUsers = teamAIds.length
    ? await User.find({ referredBy: { $in: teamAIds.map(toObjectId) } })
        .select("_id")
        .session(session ?? null)
    : []
  const teamBIds = teamBUsers.map((doc) => doc._id.toString())
  result.B = teamBIds

  const teamCUsers = teamBIds.length
    ? await User.find({ referredBy: { $in: teamBIds.map(toObjectId) } })
        .select("_id")
        .session(session ?? null)
    : []
  const teamCIds = teamCUsers.map((doc) => doc._id.toString())
  result.C = teamCIds

  const teamDUsers = teamCIds.length
    ? await User.find({ referredBy: { $in: teamCIds.map(toObjectId) } })
        .select("_id")
        .session(session ?? null)
    : []
  const teamDIds = teamDUsers.map((doc) => doc._id.toString())
  result.D = teamDIds

  return result
}

async function computeTeamEarnings(
  userId: string,
  options: ComputeOptions = {},
): Promise<TeamEarningsComputation> {
  const session = options.session
  const now = options.now ?? new Date()
  const userObjectId = ensureObjectId(userId)
  const balance = await Balance.findOne({ userId: userObjectId }).session(session ?? null)
  if (!balance) {
    throw new Error("Balance not found")
  }

  const lastClaimedAt = balance.teamRewardsLastClaimedAt ?? null
  const windowEnd = computeWindowEnd(now)
  const level = options.levelOverride ?? (await calculateUserLevel(userId))
  const commissionProfile = resolveCommissionProfile(level)

  if (!commissionProfile) {
    return {
      balance,
      windowStart: lastClaimedAt,
      windowEnd,
      commissionProfile: null,
      entries: [],
      totalCommissionCents: 0,
      totalProfitAmount: 0,
      level,
    }
  }

  if (lastClaimedAt && windowEnd.getTime() <= lastClaimedAt.getTime()) {
    return {
      balance,
      windowStart: lastClaimedAt,
      windowEnd,
      commissionProfile,
      entries: [],
      totalCommissionCents: 0,
      totalProfitAmount: 0,
      level,
    }
  }

  const teamLayers = await buildTeamLayers(userId, { session })
  const coverageSet = new Set<TeamCode>(commissionProfile.coverage)
  const memberTeamMap = new Map<string, TeamCode>()
  const coveredMemberIds: string[] = []

  for (const team of TEAM_ORDER) {
    if (!coverageSet.has(team)) continue
    for (const memberId of teamLayers[team]) {
      if (!memberTeamMap.has(memberId)) {
        memberTeamMap.set(memberId, team)
        coveredMemberIds.push(memberId)
      }
    }
  }

  if (coveredMemberIds.length === 0) {
    return {
      balance,
      windowStart: lastClaimedAt,
      windowEnd,
      commissionProfile,
      entries: [],
      totalCommissionCents: 0,
      totalProfitAmount: 0,
      level,
    }
  }

  const coveredObjectIds = coveredMemberIds.map((id) => new mongoose.Types.ObjectId(id))
  const dgps = await TeamDailyProfit.find({
    memberId: { $in: coveredObjectIds },
    profitDate: {
      $gt: lastClaimedAt ?? new Date(0),
      $lte: windowEnd,
    },
    activeOnDate: true,
    $or: [
      { claimedBy: { $exists: false } },
      { claimedBy: { $size: 0 } },
      {
        claimedBy: {
          $not: {
            $elemMatch: { userId: userObjectId },
          },
        },
      },
    ],
  })
    .session(session ?? null)
    .sort({ profitDate: 1, _id: 1 })

  const entries: DgpComputationEntry[] = []
  let totalCommissionCents = 0
  let totalProfitAmount = 0

  for (const dgp of dgps) {
    const memberTeam = memberTeamMap.get(dgp.memberId.toString())
    if (!memberTeam || !coverageSet.has(memberTeam)) {
      continue
    }

    const commissionCents = bankersRoundToCents(dgp.profitAmount * commissionProfile.rate)
    if (commissionCents <= 0) {
      continue
    }

    entries.push({
      id: dgp._id,
      profitDate: dgp.profitDate,
      profitAmount: dgp.profitAmount,
      commissionCents,
      team: memberTeam,
    })
    totalCommissionCents += commissionCents
    totalProfitAmount += dgp.profitAmount
  }

  return {
    balance,
    windowStart: lastClaimedAt,
    windowEnd,
    commissionProfile,
    entries,
    totalCommissionCents,
    totalProfitAmount,
    level,
  }
}

export async function previewTeamEarnings(userId: string, now = new Date()): Promise<TeamEarningsPreview> {
  const level = await calculateUserLevel(userId)
  const computation = await computeTeamEarnings(userId, { levelOverride: level, now })
  const available = computation.totalCommissionCents / 100
  const commissionProfile = computation.commissionProfile

  return {
    available,
    level: commissionProfile?.level ?? computation.level,
    rate: commissionProfile?.rate ?? 0,
    coverage: commissionProfile?.coverage ?? [],
    windowStart: computation.windowStart,
    windowEnd: computation.windowEnd,
    dgpCount: computation.entries.length,
    totalDgp: computation.totalProfitAmount,
    claimedTotal: computation.balance?.teamRewardsClaimed ?? 0,
    lastClaimedAt: computation.balance?.teamRewardsLastClaimedAt ?? null,
  }
}

export async function claimTeamEarnings(userId: string, now = new Date()): Promise<ClaimResult> {
  const level = await calculateUserLevel(userId)
  const session = await mongoose.startSession()
  let result: ClaimResult | null = null

  try {
    await session.withTransaction(async () => {
      const computation = await computeTeamEarnings(userId, { session, levelOverride: level, now })
      const commissionProfile = computation.commissionProfile

      if (!commissionProfile) {
        result = {
          claimed: 0,
          level: computation.level,
          rate: 0,
          coverage: [],
          windowStart: computation.windowStart,
          windowEnd: computation.windowEnd,
          dgpCount: 0,
          totalDgp: 0,
          claimedTotal: computation.balance?.teamRewardsClaimed ?? 0,
          lastClaimedAt: computation.balance?.teamRewardsLastClaimedAt ?? null,
          message: "No rewards available",
        }
        return
      }

      if (computation.totalCommissionCents <= 0) {
        if (
          computation.balance &&
          computation.windowEnd.getTime() > (computation.windowStart?.getTime() ?? -Infinity)
        ) {
          computation.balance.teamRewardsLastClaimedAt = computation.windowEnd
          computation.balance.teamRewardsAvailable = 0
          await computation.balance.save({ session })
        }

        result = {
          claimed: 0,
          level: commissionProfile.level,
          rate: commissionProfile.rate,
          coverage: commissionProfile.coverage,
          windowStart: computation.windowStart,
          windowEnd: computation.windowEnd,
          dgpCount: 0,
          totalDgp: computation.totalProfitAmount,
          claimedTotal: computation.balance?.teamRewardsClaimed ?? 0,
          lastClaimedAt: computation.balance?.teamRewardsLastClaimedAt ?? null,
          message: "No rewards available",
        }
        return
      }

      const amount = computation.totalCommissionCents / 100
      const userObjectId = ensureObjectId(userId)
      const claimDoc = await TeamDailyClaim.create(
        [
          {
            userId: userObjectId,
            amount,
            level: commissionProfile.level,
            rate: commissionProfile.rate,
            coveredTeams: commissionProfile.coverage,
            windowStart: computation.windowStart,
            windowEnd: computation.windowEnd,
            dgpIds: computation.entries.map((entry) => entry.id),
            totalDgp: computation.totalProfitAmount,
            dgpCount: computation.entries.length,
          },
        ],
        { session },
      )

      const createdClaim = Array.isArray(claimDoc) ? claimDoc[0] : claimDoc

      if (!computation.balance) {
        throw new Error("Balance not found")
      }

      computation.balance.current = (computation.balance.current ?? 0) + amount
      computation.balance.totalBalance = (computation.balance.totalBalance ?? 0) + amount
      computation.balance.totalEarning = (computation.balance.totalEarning ?? 0) + amount
      computation.balance.teamRewardsClaimed = (computation.balance.teamRewardsClaimed ?? 0) + amount
      computation.balance.teamRewardsAvailable = 0
      computation.balance.teamRewardsLastClaimedAt = computation.windowEnd
      await computation.balance.save({ session })

      const bulkResult = await TeamDailyProfit.bulkWrite(
        computation.entries.map((entry) => ({
          updateOne: {
            filter: {
              _id: entry.id,
              $or: [
                { claimedBy: { $exists: false } },
                { claimedBy: { $size: 0 } },
                {
                  claimedBy: {
                    $not: {
                      $elemMatch: { userId: userObjectId },
                    },
                  },
                },
              ],
            },
            update: {
              $push: {
                claimedBy: {
                  userId: userObjectId,
                  claimId: createdClaim._id,
                  claimedAt: now,
                },
              },
            },
          },
        })),
        { session },
      )

      if (bulkResult.modifiedCount !== computation.entries.length) {
        throw new Error("Failed to mark all team profits as claimed")
      }

      await Transaction.create(
        [
          {
            userId: userObjectId,
            type: "teamReward",
            amount,
            meta: {
              source: "team_daily_earnings",
              level: commissionProfile.level,
              rate: commissionProfile.rate,
              coveredTeams: commissionProfile.coverage,
              windowStart: computation.windowStart?.toISOString() ?? null,
              windowEnd: computation.windowEnd.toISOString(),
              dgpCount: computation.entries.length,
              totalDgp: computation.totalProfitAmount,
              claimId: createdClaim._id.toString(),
            },
            status: "approved",
          },
        ],
        { session },
      )

      await Notification.create(
        [
          {
            userId: userObjectId,
            kind: "team-reward-claimed",
            title: "Team rewards claimed",
            body: `You claimed $${amount.toFixed(2)} from daily team earnings (Level ${commissionProfile.level}, ${(
              commissionProfile.rate * 100
            ).toFixed(0)}% on Teams ${commissionProfile.coverage.join(", ")}).`,
          },
        ],
        { session },
      )

      result = {
        claimed: amount,
        level: commissionProfile.level,
        rate: commissionProfile.rate,
        coverage: commissionProfile.coverage,
        windowStart: computation.windowStart,
        windowEnd: computation.windowEnd,
        dgpCount: computation.entries.length,
        totalDgp: computation.totalProfitAmount,
        claimedTotal: computation.balance.teamRewardsClaimed,
        lastClaimedAt: computation.balance.teamRewardsLastClaimedAt ?? null,
      }
    })
  } finally {
    session.endSession()
  }

  if (!result) {
    throw new Error("Failed to resolve team earnings claim result")
  }

  return result
}
