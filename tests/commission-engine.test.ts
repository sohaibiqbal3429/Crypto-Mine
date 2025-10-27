import assert from "node:assert/strict"
import { randomUUID } from "crypto"
import test from "node:test"

process.env.SEED_IN_MEMORY = "true"

import dbConnect from "@/lib/mongodb"
import { applyDepositRewards } from "@/lib/utils/commission"
import { payDailyTeamProfit } from "@/lib/services/commission-engine"
import Balance from "@/models/Balance"
import TeamDailyProfit from "@/models/TeamDailyProfit"
import Transaction from "@/models/Transaction"
import User from "@/models/User"

const toId = (value: unknown) =>
  typeof value === "string"
    ? value
    : (value as { toString?: () => string })?.toString?.() ?? ""

async function createUser(overrides: Record<string, unknown> = {}) {
  await dbConnect()
  const unique = randomUUID().replace(/-/g, "")
  return User.create({
    email: `${unique}@example.com`,
    passwordHash: "hash",
    name: `User ${unique}`,
    role: "user",
    referralCode: unique.slice(0, 10),
    status: "active",
    depositTotal: 0,
    ...overrides,
  } as any)
}

test.before(async () => {
  await dbConnect()
})

test("direct referral pays 15% and second-level override pays 3% once", async () => {
  const leaderLeader = await createUser()
  const leader = await createUser({ referredBy: leaderLeader._id })
  const member = await createUser({ referredBy: leader._id })

  const depositAmount = 200

  const deposit = await Transaction.create({
    userId: member._id,
    type: "deposit",
    amount: depositAmount,
    status: "approved",
  } as any)

  await User.updateOne({ _id: member._id }, { $inc: { depositTotal: depositAmount } })

  const outcome = await applyDepositRewards(toId(member._id), depositAmount, {
    depositTransactionId: toId(deposit._id),
    depositAt: deposit.createdAt,
  })

  assert.equal(outcome.directCommission?.amount, depositAmount * 0.15)
  assert.equal(outcome.directCommission?.commissionPct, 15)
  assert.equal(outcome.overrideCommission?.amount, depositAmount * 0.03)
  assert.equal(outcome.overrideCommission?.commissionPct, 3)

  const leaderTransactions = await Transaction.find({
    userId: leader._id,
    type: "commission",
    "meta.source": "direct_referral",
  })
  assert.equal(leaderTransactions.length, 1)
  assert.equal(Number(leaderTransactions[0]?.amount ?? 0), depositAmount * 0.15)

  const leaderLeaderTransactions = await Transaction.find({
    userId: leaderLeader._id,
    type: "commission",
    "meta.source": "activation_override",
  })
  assert.equal(leaderLeaderTransactions.length, 1)
  assert.equal(Number(leaderLeaderTransactions[0]?.amount ?? 0), depositAmount * 0.03)

  // Running again should not duplicate payouts
  await applyDepositRewards(toId(member._id), depositAmount, {
    depositTransactionId: toId(deposit._id),
    depositAt: deposit.createdAt,
  })

  const duplicateDirect = await Transaction.find({
    userId: leader._id,
    type: "commission",
    "meta.source": "direct_referral",
  })
  assert.equal(duplicateDirect.length, 1)

  const duplicateOverride = await Transaction.find({
    userId: leaderLeader._id,
    type: "commission",
    "meta.source": "activation_override",
  })
  assert.equal(duplicateOverride.length, 1)
})

test("daily overrides pay 1% to level 1 and level 2 uplines", async () => {
  const leaderLeader = await createUser()
  const leader = await createUser({ referredBy: leaderLeader._id })
  const member = await createUser({ referredBy: leader._id })

  await TeamDailyProfit.create({
    memberId: member._id,
    profitDate: new Date("2025-01-02T12:00:00Z"),
    profitAmount: 20,
    activeOnDate: true,
  } as any)

  const results = await payDailyTeamProfit(new Date("2025-01-03T00:00:00Z"))
  const leaderResult = results.find((entry) => entry.userId === toId(leader._id))
  const leaderLeaderResult = results.find((entry) => entry.userId === toId(leaderLeader._id))

  assert.ok(leaderResult)
  assert.ok(leaderLeaderResult)
  assert.equal(leaderResult?.amount, 0.2)
  assert.equal(leaderLeaderResult?.amount, 0.2)

  const leaderBalance = await Balance.findOne({ userId: leader._id })
  assert.ok(leaderBalance)
  assert.equal(Number(leaderBalance?.totalBalance ?? 0), 0.2)

  const leaderLeaderBalance = await Balance.findOne({ userId: leaderLeader._id })
  assert.ok(leaderLeaderBalance)
  assert.equal(Number(leaderLeaderBalance?.totalBalance ?? 0), 0.2)

  // Running the payout again should be idempotent
  const repeat = await payDailyTeamProfit(new Date("2025-01-03T00:00:00Z"))
  assert.equal(repeat.length, 0)

  const overrideTransactions = await Transaction.find({
    type: "bonus",
    "meta.source": "daily_override",
  })
  assert.equal(overrideTransactions.length, 2)
})
