import assert from "node:assert/strict"
import test from "node:test"
import mongoose from "mongoose"

process.env.SEED_IN_MEMORY = "true"

import dbConnect from "@/lib/mongodb"
import Balance from "@/models/Balance"
import Transaction from "@/models/Transaction"
import User from "@/models/User"
import {
  claimTeamEarnings,
  listTeamRewardHistory,
  previewTeamEarnings,
} from "@/lib/services/team-earnings"

async function createUser(overrides: Record<string, unknown> = {}) {
  await dbConnect()
  return User.create({
    email: `user-${Math.random().toString(36).slice(2)}@example.com`,
    passwordHash: "hash",
    name: "Test User",
    role: "user",
    referralCode: Math.random().toString(36).slice(2, 12),
    status: "active",
    depositTotal: 0,
    ...overrides,
  } as any)
}

test.before(async () => {
  await dbConnect()
})

test("previewTeamEarnings reflects claimable transactions", async () => {
  const user = await createUser()
  const userId = (user._id as any).toString()

  await Balance.create({
    userId: user._id,
    current: 0,
    totalBalance: 0,
    totalEarning: 0,
    teamRewardsClaimed: 45.67,
  } as any)

  await Transaction.create([
    {
      userId: user._id,
      type: "teamReward",
      amount: 5.4321,
      status: "approved",
      claimable: true,
      meta: { source: "daily_team_earning", overridePct: 1 },
    },
    {
      userId: user._id,
      type: "teamReward",
      amount: 6.7899,
      status: "approved",
      claimable: true,
      meta: { source: "daily_team_earning", overridePct: 1 },
    },
  ] as any)

  const seededClaimables = await Transaction.countDocuments({
    userId: user._id,
    type: "teamReward",
    claimable: true,
  })
  assert.equal(seededClaimables, 2)

  const preview = await previewTeamEarnings(userId, new Date("2025-01-01T00:00:00Z"))
  const expectedAvailable = Number((5.4321 + 6.7899).toFixed(4))
  assert.equal(preview.available, expectedAvailable)
  assert.equal(preview.claimedTotal, 45.67)
  assert.equal(preview.level, 0)
  assert.equal(preview.coverage.length, 0)
})

test("claimTeamEarnings transfers available rewards", async () => {
  const user = await createUser()
  const userId = (user._id as any).toString()

  await Balance.create({
    userId: user._id,
    current: 5,
    totalBalance: 5,
    totalEarning: 5,
    teamRewardsClaimed: 10,
  } as any)

  await Transaction.create([
    {
      userId: user._id,
      type: "teamReward",
      amount: 12.5,
      status: "approved",
      claimable: true,
      meta: { source: "daily_team_earning", overridePct: 1 },
    },
    {
      userId: user._id,
      type: "teamReward",
      amount: 7.5,
      status: "approved",
      claimable: true,
      meta: { source: "daily_team_earning", overridePct: 1 },
    },
  ] as any)

  const pendingClaimables = await Transaction.countDocuments({
    userId: user._id,
    type: "teamReward",
    claimable: true,
  })
  assert.equal(pendingClaimables, 2)

  const claimTime = new Date("2025-02-01T12:00:00Z")
  const claimUserIds: (mongoose.Types.ObjectId | string)[] = [user._id as any, userId]
  if (mongoose.Types.ObjectId.isValid(userId)) {
    claimUserIds.push(new mongoose.Types.ObjectId(userId))
  }

  const beforeClaimCount = await Transaction.countDocuments({
    userId: { $in: claimUserIds },
    type: "teamReward",
  })

  const result = await claimTeamEarnings(userId, claimTime)
  assert.equal(result.claimed, 20)
  assert.equal(result.available, 0)
  assert.equal(result.claimedTotal, 30)

  const balance = await Balance.findOne({ userId: user._id })
  assert.ok(balance)
  assert.equal(balance?.teamRewardsAvailable, 0)
  assert.equal(balance?.teamRewardsClaimed, 30)
  assert.equal(balance?.current, 25)
  assert.equal(balance?.totalBalance, 25)
  assert.equal(balance?.totalEarning, 25)

  const afterClaimCount = await Transaction.countDocuments({
    userId: { $in: claimUserIds },
    type: "teamReward",
  })
  assert.equal(afterClaimCount, beforeClaimCount + 1)

  const teamRewardTransactions = await Transaction.find({
    userId: { $in: claimUserIds },
    type: "teamReward",
  }).lean()
  assert.ok(teamRewardTransactions.some((tx) => tx.meta?.source === "team_rewards_claim"))

  const claimTransaction = await Transaction.findOne({
    userId: { $in: claimUserIds },
    type: "teamReward",
    "meta.source": "team_rewards_claim",
  })
  assert.ok(claimTransaction)
  assert.equal(Number(claimTransaction?.amount ?? 0), 20)

  const originalClaimables = await Transaction.find({
    userId: user._id,
    "meta.source": "daily_team_earning",
  })

  for (const entry of originalClaimables) {
    const refreshed = await Transaction.findById(entry._id)
    assert.ok(refreshed)
    assert.equal(refreshed?.claimable, false)
    assert.equal(refreshed?.meta?.claimTransactionId?.toString(), claimTransaction?.id)
    assert.equal(refreshed?.claimedAt?.toISOString(), claimTime.toISOString())
  }
})

test("claimTeamEarnings with no balance leaves rewards untouched", async () => {
  const user = await createUser()
  const userId = (user._id as any).toString()

  await Balance.create({
    userId: user._id,
    current: 0,
    totalBalance: 0,
    totalEarning: 0,
    teamRewardsAvailable: 0,
    teamRewardsClaimed: 0,
  } as any)

  const result = await claimTeamEarnings(userId)
  assert.equal(result.claimed, 0)
  assert.equal(result.message, "No rewards available")
})

test("listTeamRewardHistory categorises transactions", async () => {
  const user = await createUser()
  const userId = (user._id as any).toString()

  await Balance.create({
    userId: user._id,
    current: 0,
    totalBalance: 0,
    totalEarning: 0,
    teamRewardsAvailable: 0,
    teamRewardsClaimed: 0,
  } as any)

  await Transaction.create([
    {
      userId: user._id,
      type: "commission",
      amount: 18,
      status: "approved",
      meta: {
        source: "direct_referral",
        referredUserName: "Alice",
        commissionPct: 15,
        sponsorLevel: 1,
      },
    },
    {
      userId: user._id,
      type: "bonus",
      amount: 1.2,
      status: "approved",
      meta: {
        source: "team_override",
        overrideKind: "team_reward",
        overridePct: 2,
        team: "A",
        fromUserName: "Bob",
      },
    },
    {
      userId: user._id,
      type: "teamReward",
      amount: 3.5,
      status: "approved",
      meta: {
        source: "daily_team_earning",
        teams: ["A", "B"],
        teamProfitPct: 2,
        level: 3,
      },
    },
    {
      userId: user._id,
      type: "teamReward",
      amount: 0.012,
      status: "approved",
      claimable: true,
      meta: {
        source: "daily_team_earning",
        overridePct: 1,
        level: 1,
      },
    },
    {
      userId: user._id,
      type: "bonus",
      amount: 0.75,
      status: "approved",
      meta: {
        source: "team_override",
        overrideKind: "daily_override",
        overridePct: 1,
        team: "B",
        teamProfit: 75,
        fromUserName: "Charlie",
      },
    },
    {
      userId: user._id,
      type: "teamReward",
      amount: 10,
      status: "approved",
      meta: {
        source: "team_rewards_claim",
      },
    },
  ] as any)

  const history = await listTeamRewardHistory(userId)
  const categories = history.map((entry) => entry.category)
  assert.ok(categories.includes("deposit_commission"))
  assert.ok(categories.includes("team_reward"))
  assert.ok(categories.includes("claim"))
  assert.ok(categories.includes("daily_team_earning"))
  assert.ok(categories.includes("daily_profit"))

  const depositEntry = history.find((entry) => entry.category === "deposit_commission")
  assert.equal(depositEntry?.sourceUserName, "Alice")
  assert.equal(depositEntry?.rate, 15)

  const rewardEntry = history.find((entry) => entry.category === "team_reward")
  assert.equal(rewardEntry?.team, "A")
  assert.equal(rewardEntry?.rate, 2)

  const dailyTeamEntries = history.filter((entry) => entry.category === "daily_team_earning")
  const aggregatedDailyTeamEntry = dailyTeamEntries.find((entry) => entry.teams?.length)
  assert.ok(aggregatedDailyTeamEntry)
  assert.deepEqual(aggregatedDailyTeamEntry?.teams, ["A", "B"])
  assert.equal(aggregatedDailyTeamEntry?.rate, 2)
  assert.equal(aggregatedDailyTeamEntry?.level, 3)

  const claimableDailyTeamEntry = dailyTeamEntries.find((entry) => Math.abs(entry.amount - 0.012) < 1e-9)
  assert.ok(claimableDailyTeamEntry)
  assert.equal(claimableDailyTeamEntry?.rate, 1)

  const dailyProfitEntry = history.find((entry) => entry.category === "daily_profit")
  assert.equal(dailyProfitEntry?.rate, 1)
  assert.equal(dailyProfitEntry?.amount, 0.75)
  assert.equal(dailyProfitEntry?.team, "B")
})

