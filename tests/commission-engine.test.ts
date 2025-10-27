import assert from "node:assert/strict"
import { randomUUID } from "crypto"
import test from "node:test"

process.env.SEED_IN_MEMORY = "true"

import dbConnect from "@/lib/mongodb"
import { applyDepositRewards } from "@/lib/utils/commission"
import { payDailyTeamProfit } from "@/lib/services/commission-engine"
import { runDailyMiningProfit } from "@/lib/services/daily-mining"
import Balance from "@/models/Balance"
import TeamDailyProfit from "@/models/TeamDailyProfit"
import Transaction from "@/models/Transaction"
import User from "@/models/User"

const toId = (value: unknown) => {
  if (typeof value === "string") return value
  if (!value) return ""

  if (typeof (value as { toHexString?: () => string }).toHexString === "function") {
    return (value as { toHexString: () => string }).toHexString()
  }

  if (typeof (value as { toString?: () => string }).toString === "function") {
    const str = (value as { toString: () => string }).toString()
    if (str && str !== "[object Object]") {
      return str
    }
  }

  if (typeof (value as { buffer?: ArrayLike<number> }).buffer === "object") {
    const bufferLike = (value as { buffer: ArrayLike<number> }).buffer
    const bytes = Array.from(bufferLike ?? [])
    if (bytes.length) {
      return Buffer.from(bytes).toString("hex")
    }
  }

  return JSON.stringify(value)
}

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

function toPlain<T = any>(doc: any): T {
  if (doc && typeof doc.toObject === "function") {
    return doc.toObject() as T
  }
  return doc as T
}

test.before(async () => {
  await dbConnect()
})

test("direct referral pays 15% and second-level override pays 3% once", async () => {
  const leaderLeader = await createUser()
  const leader = await createUser({ referredBy: leaderLeader._id })
  const member = await createUser({ referredBy: leader._id, status: "inactive", isActive: false })

  const depositAmount = 200

  const deposit = await Transaction.create({
    userId: member._id,
    type: "deposit",
    amount: depositAmount,
    status: "approved",
  } as any)

  await User.updateOne({ _id: member._id }, { $inc: { depositTotal: depositAmount } })

  const activationId = toId(deposit._id)
  const outcome = await applyDepositRewards(toId(member._id), depositAmount, {
    depositTransactionId: activationId,
    depositAt: deposit.createdAt,
    activationId,
  })

  const expectedDirect = Number((depositAmount * 0.15).toFixed(4))
  const expectedOverride = Number((depositAmount * 0.03).toFixed(4))

  assert.equal(outcome.directCommission?.amount, expectedDirect)
  assert.equal(outcome.directCommission?.commissionPct, 15)
  assert.equal(outcome.overrideCommission?.amount, expectedOverride)
  assert.equal(outcome.overrideCommission?.commissionPct, 3)

  const allTransactions = (await Transaction.find()).map((tx) => toPlain<any>(tx))

  const leaderTransactions = allTransactions.filter(
    (tx) => tx.type === "commission" && toId(tx.userId) === toId(leader._id),
  )
  assert.equal(leaderTransactions.length, 1)
  assert.equal(Number(leaderTransactions[0]?.amount ?? 0), expectedDirect)
  assert.equal(Number(leaderTransactions[0]?.meta?.commissionBase ?? 0), depositAmount)
  assert.equal(leaderTransactions[0]?.meta?.activationId, activationId)

  const leaderLeaderTransactions = allTransactions.filter(
    (tx) => tx.type === "commission" && toId(tx.userId) === toId(leaderLeader._id),
  )
  assert.equal(leaderLeaderTransactions.length, 1)
  assert.equal(Number(leaderLeaderTransactions[0]?.amount ?? 0), expectedOverride)
  assert.equal(Number(leaderLeaderTransactions[0]?.meta?.commissionBase ?? 0), depositAmount)
  assert.equal(leaderLeaderTransactions[0]?.meta?.activationId, activationId)

  // Running again should not duplicate payouts
  await applyDepositRewards(toId(member._id), depositAmount, {
    depositTransactionId: activationId,
    depositAt: deposit.createdAt,
    activationId,
  })

  const duplicateDirect = allTransactions.filter(
    (tx) => tx.type === "commission" && toId(tx.userId) === toId(leader._id),
  )
  assert.equal(duplicateDirect.length, 1)

  const duplicateOverride = allTransactions.filter(
    (tx) => tx.type === "commission" && toId(tx.userId) === toId(leaderLeader._id),
  )
  assert.equal(duplicateOverride.length, 1)
})

test("top-ups do not trigger additional activation commissions", async () => {
  const leaderLeader = await createUser()
  const leader = await createUser({ referredBy: leaderLeader._id })
  const member = await createUser({ referredBy: leader._id, status: "inactive", isActive: false })

  const activationDeposit = await Transaction.create({
    userId: member._id,
    type: "deposit",
    amount: 120,
    status: "approved",
  } as any)

  await User.updateOne({ _id: member._id }, { $inc: { depositTotal: 120 } })

  const activationId = toId(activationDeposit._id)
  const activationOutcome = await applyDepositRewards(toId(member._id), 120, {
    depositTransactionId: activationId,
    depositAt: activationDeposit.createdAt,
    activationId,
  })

  assert.equal(Number(activationOutcome.directCommission?.amount ?? 0), Number((120 * 0.15).toFixed(4)))
  assert.equal(Number(activationOutcome.overrideCommission?.amount ?? 0), Number((120 * 0.03).toFixed(4)))

  const topUpDeposit = await Transaction.create({
    userId: member._id,
    type: "deposit",
    amount: 150,
    status: "approved",
  } as any)

  await User.updateOne({ _id: member._id }, { $inc: { depositTotal: 150 } })

  const topUpId = toId(topUpDeposit._id)
  const topUpOutcome = await applyDepositRewards(toId(member._id), 150, {
    depositTransactionId: topUpId,
    depositAt: topUpDeposit.createdAt,
    activationId: topUpId,
  })

  assert.equal(topUpOutcome.directCommission, null)
  assert.equal(topUpOutcome.overrideCommission, null)
  assert.equal(topUpOutcome.activated, false)

  const allCommissionTx = (await Transaction.find({ type: "commission" })).map((tx) => toPlain<any>(tx))
  const leaderDirects = allCommissionTx.filter(
    (tx) => tx.meta?.source === "direct_referral" && toId(tx.userId) === toId(leader._id),
  )

  assert.equal(leaderDirects.length, 1)
  assert.equal(Number(leaderDirects[0]?.meta?.commissionBase ?? 0), 120)

  const level2Overrides = allCommissionTx.filter(
    (tx) => tx.meta?.source === "activation_override" && toId(tx.userId) === toId(leaderLeader._id),
  )

  assert.equal(level2Overrides.length, 1)
  assert.equal(Number(level2Overrides[0]?.meta?.commissionBase ?? 0), 120)
})

test("level-2 override requires activation threshold", async () => {
  const leaderLeader = await createUser()
  const leader = await createUser({ referredBy: leaderLeader._id })
  const member = await createUser({ referredBy: leader._id, status: "inactive", isActive: false })

  const activation79 = await Transaction.create({
    userId: member._id,
    type: "deposit",
    amount: 79,
    status: "approved",
  } as any)

  await User.updateOne({ _id: member._id }, { $inc: { depositTotal: 79 } })

  await applyDepositRewards(toId(member._id), 79, {
    depositTransactionId: toId(activation79._id),
    depositAt: activation79.createdAt,
    activationId: toId(activation79._id),
  })

  const allAfter79 = (await Transaction.find()).map((tx) => toPlain<any>(tx))
  const l2After79 = allAfter79.filter(
    (tx) => tx.type === "commission" && toId(tx.userId) === toId(leaderLeader._id),
  )
  assert.equal(l2After79.length, 0)

  const leaderLeader2 = await createUser()
  const leader2 = await createUser({ referredBy: leaderLeader2._id })
  const member2 = await createUser({ referredBy: leader2._id, status: "inactive", isActive: false })

  const activation80 = await Transaction.create({
    userId: member2._id,
    type: "deposit",
    amount: 80,
    status: "approved",
  } as any)

  await User.updateOne({ _id: member2._id }, { $inc: { depositTotal: 80 } })

  await applyDepositRewards(toId(member2._id), 80, {
    depositTransactionId: toId(activation80._id),
    depositAt: activation80.createdAt,
    activationId: toId(activation80._id),
  })

  const allAfter80 = (await Transaction.find()).map((tx) => toPlain<any>(tx))
  const l2After80 = allAfter80.filter(
    (tx) => tx.type === "commission" && toId(tx.userId) === toId(leaderLeader2._id),
  )
  assert.equal(l2After80.length, 1)
  assert.equal(Number(l2After80[0]?.amount ?? 0), Number((80 * 0.03).toFixed(4)))
})

test("daily overrides pay 1% to level 1 and level 2 uplines", async () => {
  const leaderLeader = await createUser()
  const leader = await createUser({ referredBy: leaderLeader._id })
  const member = await createUser({ referredBy: leader._id, status: "inactive", isActive: false })

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

  const balances = (await Balance.find()).map((doc) => toPlain<any>(doc))
  const leaderBalance = balances.find((doc) => toId(doc.userId) === toId(leader._id))
  assert.ok(leaderBalance)
  assert.equal(Number(leaderBalance?.totalBalance ?? 0), 0.2)

  const leaderLeaderBalance = balances.find((doc) => toId(doc.userId) === toId(leaderLeader._id))
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

test("daily mining uses current balance and feeds overrides", async () => {
  const leaderLeader = await createUser()
  const leader = await createUser({ referredBy: leaderLeader._id })
  const member = await createUser({ referredBy: leader._id, status: "inactive", isActive: false })

  await Transaction.deleteMany({})
  await TeamDailyProfit.deleteMany({})
  await Balance.deleteMany({})

  await Balance.create({
    userId: member._id,
    current: 30,
    totalBalance: 500,
    totalEarning: 100,
  } as any)

  const miningDay = new Date("2025-02-02T00:00:00Z")
  await runDailyMiningProfit(miningDay)
  const allDgpEntries = (await TeamDailyProfit.find()).map((doc) => toPlain<any>(doc))

  const miningTransactions = (await Transaction.find({ "meta.source": "daily_mining_profit" })).map((tx) =>
    toPlain<any>(tx),
  )
  const memberTransactions = miningTransactions.filter((tx) => toId(tx.userId) === toId(member._id))
  assert.equal(memberTransactions.length, 1)
  const baseTx = memberTransactions[0]
  assert.ok(baseTx)
  assert.equal(Number(baseTx?.amount ?? 0), Number((30 * 0.015).toFixed(4)))
  assert.equal(Number(baseTx?.meta?.baseAmount ?? 0), 30)

  const memberDoc = toPlain<any>(await User.findById(member._id))
  const leaderDoc = toPlain<any>(await User.findById(leader._id))

  const dgp = (await TeamDailyProfit.find())
    .map((doc) => toPlain<any>(doc))
    .find((doc) => toId(doc.memberId) === toId(member._id))
  assert.ok(dgp)
  assert.equal(Number(dgp?.profitAmount ?? 0), Number((30 * 0.015).toFixed(4)))

  const overrideResults = await payDailyTeamProfit(new Date("2025-02-02T00:00:00Z"))
  const l1 = overrideResults.find((entry) => entry.userId === toId(leader._id))
  const l2 = overrideResults.find((entry) => entry.userId === toId(leaderLeader._id))
  assert.ok(l1)
  assert.ok(l2)
  assert.equal(Number(l1?.amount ?? 0), Number(((30 * 0.015) * 0.01).toFixed(4)))
  assert.equal(Number(l2?.amount ?? 0), Number(((30 * 0.015) * 0.01).toFixed(4)))
})

test("missing uplines are skipped without errors", async () => {
  const leader = await createUser()
  const member = await createUser({ referredBy: leader._id })

  await TeamDailyProfit.create({
    memberId: member._id,
    profitDate: new Date("2025-03-02T12:00:00Z"),
    profitAmount: 10,
    activeOnDate: true,
  } as any)

  const outcomes = await payDailyTeamProfit(new Date("2025-03-03T00:00:00Z"))
  assert.equal(outcomes.length, 1)
  assert.equal(outcomes[0]?.level, 1)
  assert.equal(outcomes[0]?.userId, toId(leader._id))

  const hasLevel2 = outcomes.some((entry) => entry.level === 2)
  assert.equal(hasLevel2, false)
})
