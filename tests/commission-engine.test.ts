import assert from "node:assert/strict"
import { randomUUID } from "crypto"
import test from "node:test"

process.env.SEED_IN_MEMORY = "true"

import dbConnect from "@/lib/mongodb"
import { applyDepositRewards } from "@/lib/utils/commission"
import { runDailyMiningProfit } from "@/lib/services/daily-mining"
import Balance from "@/models/Balance"
import TeamDailyProfit from "@/models/TeamDailyProfit"
import Transaction from "@/models/Transaction"
import User from "@/models/User"
import LedgerEntry from "@/models/LedgerEntry"

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

  await LedgerEntry.deleteMany({})

  const depositAmount = 200

  const deposit = await Transaction.create({
    userId: member._id,
    type: "deposit",
    amount: depositAmount,
    status: "approved",
  } as any)

  await User.updateOne({ _id: member._id }, { $inc: { depositTotal: depositAmount } })

  const activationId = toId(deposit._id)
  const outcome: any = await applyDepositRewards(
    toId(member._id),
    depositAmount,
    {
      depositTransactionId: activationId,
      depositAt: deposit.createdAt,
      activationId,
    } as any,
  )

  const expectedDirect = Number((depositAmount * 0.15).toFixed(4))
  const expectedOverride = Number((depositAmount * 0.03).toFixed(4))

  assert.equal(outcome.directCommission?.amount, expectedDirect)
  assert.equal(outcome.directCommission?.pct, 15)
  assert.equal(outcome.overrideCommission?.amount, expectedOverride)
  assert.equal(outcome.overrideCommission?.commissionPct, 3)

  const allTransactions = (await Transaction.find()).map((tx) => toPlain<any>(tx))

  const leaderTransactions = allTransactions.filter(
    (tx) =>
      tx.type === "commission" &&
      tx.meta?.source === "direct_referral" &&
      toId(tx.userId) === toId(leader._id),
  )
  assert.equal(leaderTransactions.length, 1)
  assert.equal(Number(leaderTransactions[0]?.amount ?? 0), expectedDirect)
  assert.equal(Number(leaderTransactions[0]?.meta?.depositAmount ?? 0), depositAmount)
  assert.equal(leaderTransactions[0]?.meta?.depositTransactionId, activationId)
  assert.equal(leaderTransactions[0]?.claimable ?? false, false)

  const leaderLeaderTransactions = allTransactions.filter(
    (tx) =>
      tx.type === "commission" &&
      tx.meta?.source === "activation_level2_override" &&
      toId(tx.userId) === toId(leaderLeader._id),
  )
  assert.equal(leaderLeaderTransactions.length, 1)
  assert.equal(Number(leaderLeaderTransactions[0]?.amount ?? 0), expectedOverride)
  assert.equal(Number(leaderLeaderTransactions[0]?.meta?.depositAmount ?? 0), depositAmount)
  assert.equal(leaderLeaderTransactions[0]?.meta?.depositTransactionId, activationId)
  assert.equal(leaderLeaderTransactions[0]?.claimable ?? false, false)

  const memberTransactions = allTransactions.filter(
    (tx) =>
      tx.type === "bonus" &&
      tx.meta?.source === "self_deposit_bonus" &&
      toId(tx.userId) === toId(member._id),
  )
  assert.equal(memberTransactions.length, 0)

  const ledgerEntries = await LedgerEntry.find({ type: "deposit_commission" }).lean()
  assert.equal(ledgerEntries.length, 1)
  assert.equal(Number(ledgerEntries[0]?.amount ?? 0), expectedDirect)
  assert.equal(Number(ledgerEntries[0]?.rate ?? 0), 15)
  assert.equal(toId(ledgerEntries[0]?.beneficiaryId), toId(leader._id))
  assert.equal(toId(ledgerEntries[0]?.sourceUserId), toId(member._id))

  // Running again should not duplicate payouts
  await applyDepositRewards(
    toId(member._id),
    depositAmount,
    {
      depositTransactionId: activationId,
      depositAt: deposit.createdAt,
      activationId,
    } as any,
  )

  const afterDuplicate = (await Transaction.find()).map((tx) => toPlain<any>(tx))

  const duplicateDirect = afterDuplicate.filter(
    (tx) =>
      tx.type === "commission" &&
      tx.meta?.source === "direct_referral" &&
      toId(tx.userId) === toId(leader._id),
  )
  assert.equal(duplicateDirect.length, 1)

  const duplicateOverride = afterDuplicate.filter(
    (tx) =>
      tx.type === "commission" &&
      tx.meta?.source === "activation_level2_override" &&
      toId(tx.userId) === toId(leaderLeader._id),
  )
  assert.equal(duplicateOverride.length, 1)

  const duplicateSelf = afterDuplicate.filter(
    (tx) =>
      tx.type === "bonus" &&
      tx.meta?.source === "self_deposit_bonus" &&
      toId(tx.userId) === toId(member._id),
  )
  assert.equal(duplicateSelf.length, 0)
})

test("self-deposit bonus credits 5% once per deposit", async () => {
  const member = await createUser({ status: "active", isActive: true, depositTotal: 80 })

  const depositAmount = 100
  const deposit = await Transaction.create({
    userId: member._id,
    type: "deposit",
    amount: depositAmount,
    status: "approved",
  } as any)

  await User.updateOne({ _id: member._id }, { $inc: { depositTotal: depositAmount } })

  const depositId = toId(deposit._id)

  await applyDepositRewards(
    toId(member._id),
    depositAmount,
    {
      depositTransactionId: depositId,
      depositAt: deposit.createdAt,
      activationId: depositId,
    } as any,
  )


  const selfUniqueKey = `${toId(member._id)}|${depositId}|self5`
  const reward = await Transaction.findOne({
    type: "bonus",
    "meta.uniqueEventId": selfUniqueKey,
  })

  assert.ok(reward)
  assert.equal(Number(toPlain<any>(reward)?.amount ?? 0), Number((depositAmount * 0.05).toFixed(4)))
  assert.equal(toPlain<any>(reward)?.claimable, false)

  await applyDepositRewards(
    toId(member._id),
    depositAmount,
    {
      depositTransactionId: depositId,
      depositAt: deposit.createdAt,
      activationId: depositId,
    } as any,
  )

  const rewardAfter = await Transaction.find({
    type: "bonus",
    "meta.uniqueEventId": selfUniqueKey,
  })

  assert.equal(rewardAfter.length, 1)

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
  const activationOutcome: any = await applyDepositRewards(
    toId(member._id),
    120,
    {
      depositTransactionId: activationId,
      depositAt: activationDeposit.createdAt,
      activationId,
    } as any,
  )

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
  const topUpOutcome: any = await applyDepositRewards(
    toId(member._id),
    150,
    {
      depositTransactionId: topUpId,
      depositAt: topUpDeposit.createdAt,
      activationId: topUpId,
    } as any,
  )

  assert.equal(Number(topUpOutcome.directCommission?.amount ?? 0), Number((150 * 0.15).toFixed(4)))
  assert.equal(Number(topUpOutcome.overrideCommission?.amount ?? 0), Number((150 * 0.03).toFixed(4)))
  assert.equal(topUpOutcome.activated, false)

  const allCommissionTx = (await Transaction.find({ type: "commission" })).map((tx) => toPlain<any>(tx))
  const leaderDirects = allCommissionTx.filter(
    (tx) => tx.meta?.source === "direct_referral" && toId(tx.userId) === toId(leader._id),
  )

  assert.equal(leaderDirects.length, 2)
  assert.deepEqual(
    leaderDirects
      .map((tx) => Number(tx.meta?.depositAmount ?? 0))
      .sort((a, b) => a - b),
    [120, 150],
  )

  const level2Overrides = allCommissionTx.filter(
    (tx) => tx.meta?.source === "activation_level2_override" && toId(tx.userId) === toId(leaderLeader._id),
  )

  assert.equal(level2Overrides.length, 2)
  assert.deepEqual(
    level2Overrides
      .map((tx) => Number(tx.meta?.depositAmount ?? 0))
      .sort((a, b) => a - b),
    [120, 150],
  )
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

  await applyDepositRewards(
    toId(member._id),
    79,
    {
      depositTransactionId: toId(activation79._id),
      depositAt: activation79.createdAt,
      activationId: toId(activation79._id),
    } as any,
  )

  const allAfter79 = (await Transaction.find()).map((tx) => toPlain<any>(tx))
  const l2After79 = allAfter79.filter(
    (tx) =>
      tx.type === "commission" &&
      tx.meta?.source === "activation_level2_override" &&
      toId(tx.userId) === toId(leaderLeader._id),
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

  await applyDepositRewards(
    toId(member2._id),
    80,
    {
      depositTransactionId: toId(activation80._id),
      depositAt: activation80.createdAt,
      activationId: toId(activation80._id),
    } as any,
  )

  const allAfter80 = (await Transaction.find()).map((tx) => toPlain<any>(tx))
  const l2After80 = allAfter80.filter(
    (tx) =>
      tx.type === "commission" &&
      tx.meta?.source === "activation_level2_override" &&
      toId(tx.userId) === toId(leaderLeader2._id),
  )
  assert.equal(l2After80.length, 1)
  assert.equal(Number(l2After80[0]?.amount ?? 0), Number((80 * 0.03).toFixed(4)))
})

