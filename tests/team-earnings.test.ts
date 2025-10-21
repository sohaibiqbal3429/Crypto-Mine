import assert from "node:assert/strict"
import test from "node:test"

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

test("previewTeamEarnings reflects balance snapshot", async () => {
  const user = await createUser()
  const userId = (user._id as any).toString()

  await Balance.create({
    userId: user._id,
    current: 0,
    totalBalance: 0,
    totalEarning: 0,
    teamRewardsAvailable: 12.34,
    teamRewardsClaimed: 45.67,
  } as any)

  const preview = await previewTeamEarnings(userId, new Date("2025-01-01T00:00:00Z"))
  assert.equal(preview.available, 12.34)
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
    teamRewardsAvailable: 20,
    teamRewardsClaimed: 10,
  } as any)

  const claimTime = new Date("2025-02-01T12:00:00Z")
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

  const transactions = await Transaction.find({ userId: user._id, type: "teamReward" })
  if (transactions.length > 0) {
    assert.equal(transactions[0]?.meta?.source, "team_rewards_claim")
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
      amount: 7,
      status: "approved",
      meta: {
        source: "direct_referral",
        referredUserName: "Alice",
        commissionPct: 7,
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

  const depositEntry = history.find((entry) => entry.category === "deposit_commission")
  assert.equal(depositEntry?.sourceUserName, "Alice")
  assert.equal(depositEntry?.rate, 7)

  const rewardEntry = history.find((entry) => entry.category === "team_reward")
  assert.equal(rewardEntry?.team, "A")
  assert.equal(rewardEntry?.rate, 2)

  const dailyTeamEntry = history.find((entry) => entry.category === "daily_team_earning")
  assert.deepEqual(dailyTeamEntry?.teams, ["A", "B"])
  assert.equal(dailyTeamEntry?.rate, 2)
  assert.equal(dailyTeamEntry?.level, 3)
})

