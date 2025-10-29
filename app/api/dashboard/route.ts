import mongoose from "mongoose"

import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Balance from "@/models/Balance"
import MiningSession from "@/models/MiningSession"
import Settings from "@/models/Settings"
import Transaction from "@/models/Transaction"
import { getUserFromRequest } from "@/lib/auth"
import { hasQualifiedDeposit } from "@/lib/utils/leveling"
import { getClaimableTeamRewardTotal } from "@/lib/services/team-earnings"

function ensureObjectId(value: mongoose.Types.ObjectId | string) {
  if (value instanceof mongoose.Types.ObjectId) {
    return value
  }

  if (typeof value === "string" && mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value)
  }

  throw new Error("Invalid ObjectId value")
}

function resolvePreviousUtcDayWindow(reference: Date) {
  const start = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate() - 1, 0, 0, 0, 0),
  )
  const end = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate() - 1, 23, 59, 59, 999),
  )

  return { start, end, dayKey: start.toISOString().slice(0, 10) }
}

export async function getDailyTeamRewardTotal(
  userId: mongoose.Types.ObjectId | string,
  now: Date,
): Promise<number> {
  const { start, end, dayKey } = resolvePreviousUtcDayWindow(now)
  const userIdString = typeof userId === "string" ? userId : userId.toString()
  const idCandidates: (string | mongoose.Types.ObjectId)[] = [userIdString]

  if (mongoose.Types.ObjectId.isValid(userIdString)) {
    idCandidates.push(new mongoose.Types.ObjectId(userIdString))
  }

  const results = await Transaction.aggregate([
    {
      $match: {
        userId: { $in: idCandidates },
        type: "teamReward",
        status: "approved",
        "meta.source": "daily_team_earning",
        $or: [
          { "meta.day": dayKey },
          {
            createdAt: {
              $gte: start,
              $lte: end,
            },
          },
        ],
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" },
      },
    },
  ])

  return Number(results?.[0]?.total ?? 0)
}

export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const user = await User.findById(userPayload.userId)
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (user.isBlocked) {
      return NextResponse.json({ error: "Account blocked", blocked: true }, { status: 403 })
    }

    const userObjectId = ensureObjectId(user._id as any)

    let balance = await Balance.findOne({ userId: userObjectId })
    if (!balance) {
      balance = await Balance.create({
        userId: userObjectId,
        current: 0,
        totalBalance: 0,
        totalEarning: 0,
        lockedCapital: 0,
        staked: 0,
        pendingWithdraw: 0,
        teamRewardsAvailable: 0,
        teamRewardsClaimed: 0,
      })
    }

    let miningSession = await MiningSession.findOne({ userId: userObjectId })
    if (!miningSession) {
      miningSession = await MiningSession.create({ userId: userObjectId })
    }

    const settings = await Settings.findOne()

    const [directReferrals, claimableTeamRewards] = await Promise.all([
      User.find({ referredBy: userObjectId }).select("qualified depositTotal").lean(),
      getClaimableTeamRewardTotal(userObjectId.toString()),
    ])
    const activeMembers = directReferrals.filter((referral) => hasQualifiedDeposit(referral)).length

    const now = new Date()
    const nextEligibleAt = miningSession.nextEligibleAt ?? now
    const minDeposit = settings?.gating?.minDeposit ?? 30
    const hasMinimumDeposit = (user.depositTotal ?? 0) >= minDeposit
    const canMine = hasMinimumDeposit && now >= nextEligibleAt

    const teamRewardsAvailable = claimableTeamRewards
    const teamRewardToday = await getDailyTeamRewardTotal(userObjectId, now)
    const totalEarning = balance.totalEarning ?? 0
    const totalBalance = balance.totalBalance ?? 0
    const currentBalance = balance.current ?? 0

    return NextResponse.json({
      kpis: {
        totalEarning,
        totalBalance,
        currentBalance,
        activeMembers,
        totalWithdraw: user.withdrawTotal ?? 0,
        pendingWithdraw: balance.pendingWithdraw ?? 0,
        teamReward: teamRewardsAvailable,
        teamRewardToday,
      },
      mining: {
        canMine,
        requiresDeposit: !hasMinimumDeposit,
        minDeposit,
        nextEligibleAt: nextEligibleAt.toISOString(),
        earnedInCycle: miningSession.earnedInCycle ?? 0,
      },
      user: {
        level: user.level ?? 0,
        referralCode: user.referralCode ?? "",
        roiEarnedTotal: user.roiEarnedTotal ?? 0,
        depositTotal: user.depositTotal ?? 0,
      },
    })
  } catch (error) {
    console.error("Dashboard error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
