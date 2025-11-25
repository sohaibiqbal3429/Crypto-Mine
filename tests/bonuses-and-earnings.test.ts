import assert from "node:assert/strict"
import test from "node:test"
import mongoose from "mongoose"

process.env.SEED_IN_MEMORY = "true"

import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Balance from "@/models/Balance"
import Transaction from "@/models/Transaction"
import BonusPayout from "@/models/Payout"
import {
  applyDepositRewards,
  createTeamEarningPayouts,
  claimTeamEarningPayouts,
  getPendingTeamEarnings,
} from "@/lib/services/rewards"
import {
  ACTIVE_DEPOSIT_THRESHOLD,
  DEPOSIT_L1_PERCENT,
  DEPOSIT_L2_PERCENT_ACTIVE,
  DEPOSIT_SELF_PERCENT_ACTIVE,
  TEAM_EARN_L1_PERCENT,
  TEAM_EARN_L2_PERCENT,
} from "@/lib/constants/bonuses"

async function resetCollections() {
  await dbConnect()
  await Promise.all([
    User.deleteMany({}),
    Balance.deleteMany({}),
    Transaction.deleteMany({}),
    BonusPayout.deleteMany({}),
  ])
}

function toHex(value: unknown): string {
  if (value instanceof mongoose.Types.ObjectId) {
    return value.toHexString()
  }
  if (typeof value === "string") {
    return value
  }
  return new mongoose.Types.ObjectId(String(value ?? "")).toHexString()
}

async function createUser(overrides: Record<string, unknown> = {}) {
  await dbConnect()
  const defaults = {
    email: `user-${Math.random().toString(36).slice(2)}@example.com`,
    passwordHash: "hash",
    name: "Test User",
    role: "user",
    referralCode: Math.random().toString(36).slice(2, 10),
    status: "active",
    isActive: false,
    depositTotal: 0,
    withdrawTotal: 0,
    roiEarnedTotal: 0,
  }
  return User.create({ ...defaults, ...overrides } as any)
}

async function approveDeposit(userId: mongoose.Types.ObjectId, amount: number) {
  const transaction = await Transaction.create({
    userId,
    type: "deposit",
    amount,
    status: "pending",
  })

  transaction.status = "approved"
  await transaction.save()

  const user = await User.findById(userId)
  assert.ok(user)
  const before = Number(user.depositTotal ?? 0)
  const after = before + amount
  const wasActive = before >= ACTIVE_DEPOSIT_THRESHOLD
  const nowActive = after >= ACTIVE_DEPOSIT_THRESHOLD

  user.depositTotal = after
  user.isActive = nowActive
  user.status = nowActive ? "active" : "inactive"
  await user.save()

  await Balance.updateOne(
    { userId },
    {
      $inc: { current: amount, totalBalance: amount },
      $setOnInsert: { totalEarning: 0, staked: 0, pendingWithdraw: 0 },
    },
    { upsert: true },
  )

  const outcome = await applyDepositRewards(userId.toString(), amount, {
    depositTransactionId: toHex(transaction._id),
    depositAt: transaction.createdAt,
  })

  return { transaction, before, after, wasActive, nowActive, outcome }
}

async function getBalanceAmount(userId: mongoose.Types.ObjectId) {
  const balance = await Balance.findOne({ userId })
  return Number(balance?.current ?? 0)
}

test.before(async () => {
  await dbConnect()
})

test.beforeEach(async () => {
  await resetCollections()
})

test("user activates at lifetime deposit threshold", async () => {
  const user = await createUser({ depositTotal: 0, isActive: false })
  const userId = user._id as mongoose.Types.ObjectId

  const first = await approveDeposit(userId, 50)
  assert.equal(first.nowActive, false)
  const depositor = await User.findById(userId)
  assert.ok(depositor)
  assert.equal(depositor.isActive, false)
  assert.equal(depositor.depositTotal, 50)

  const second = await approveDeposit(userId, 30)
  assert.equal(second.nowActive, true)
  const updated = await User.findById(userId)
  assert.ok(updated)
  assert.equal(updated.isActive, true)
  assert.equal(updated.depositTotal, 80)

  const selfBonusPayouts = await BonusPayout.find({
    receiverUserId: userId,
    type: "DEPOSIT_BONUS_SELF",
  })
    .lean()
  assert.equal(selfBonusPayouts.length, 1)
  const expectedBonus = Number((30 * DEPOSIT_SELF_PERCENT_ACTIVE).toFixed(4))
  assert.equal(Number(selfBonusPayouts[0]?.payoutAmount ?? 0), expectedBonus)
})

test("referral payouts use depositor's updated activation status", async () => {
  const { member, l1, l2 } = await setupReferralChain()

  const first = await approveDeposit(member._id as mongoose.Types.ObjectId, 50)
  assert.equal(first.outcome.depositorActive, false)

  const firstPayouts = await BonusPayout.find({
    sourceTxId: toHex(first.transaction._id),
  })
    .sort({ createdAt: 1 })
    .lean()

  assert.equal(firstPayouts.length, 1)
  assert.equal(firstPayouts[0]?.type, "DEPOSIT_L1")
  assert.equal(
    Number((firstPayouts[0]?.payoutAmount ?? 0).toFixed(4)),
    Number((50 * DEPOSIT_L1_PERCENT).toFixed(4)),
  )

  const second = await approveDeposit(member._id as mongoose.Types.ObjectId, 30)
  assert.equal(second.outcome.depositorActive, true)

  const secondPayouts = await BonusPayout.find({
    sourceTxId: toHex(second.transaction._id),
  })
    .sort({ createdAt: 1, type: 1 })
    .lean()

  const secondTypes = secondPayouts.map((payout) => payout?.type)
  assert.deepEqual(secondTypes.sort(), ["DEPOSIT_BONUS_SELF", "DEPOSIT_L1", "DEPOSIT_L2"].sort())

  const byType = Object.fromEntries(
    secondPayouts.map((payout) => [payout.type, Number((payout.payoutAmount ?? 0).toFixed(4))]),
  ) as Record<string, number>

  assert.equal(byType.DEPOSIT_BONUS_SELF, Number((30 * DEPOSIT_SELF_PERCENT_ACTIVE).toFixed(4)))
  assert.equal(byType.DEPOSIT_L1, Number((30 * DEPOSIT_L1_PERCENT).toFixed(4)))
  assert.equal(byType.DEPOSIT_L2, Number((30 * DEPOSIT_L2_PERCENT_ACTIVE).toFixed(4)))

  const l1Total = await sumPayouts({ type: "DEPOSIT_L1", receiverUserId: l1._id })
  assert.equal(Number(l1Total.toFixed(4)), Number(((50 + 30) * DEPOSIT_L1_PERCENT).toFixed(4)))

  const l2Total = await sumPayouts({ type: "DEPOSIT_L2", receiverUserId: l2._id })
  assert.equal(Number(l2Total.toFixed(4)), Number((30 * DEPOSIT_L2_PERCENT_ACTIVE).toFixed(4)))
})

async function setupReferralChain() {
  const l2 = await createUser({ name: "L2", email: `l2-${Date.now()}@example.com` })
  const l1 = await createUser({ name: "L1", email: `l1-${Date.now()}@example.com`, referredBy: l2._id })
  const member = await createUser({
    name: "Member",
    email: `member-${Date.now()}@example.com`,
    referredBy: l1._id,
  })
  return { member, l1, l2 }
}

function sumPayouts(filter: Record<string, unknown>) {
  return BonusPayout.find(filter)
    .lean()
    .then((docs) => docs.reduce((total, doc) => total + Number(doc.payoutAmount ?? 0), 0))
}

test("inactive depositor pays only L1 referral", async () => {
  const { member, l1, l2 } = await setupReferralChain()
  const { outcome } = await approveDeposit(member._id as mongoose.Types.ObjectId, 40)

  assert.equal(outcome.depositorActive, false)
  const selfBalance = await getBalanceAmount(member._id as mongoose.Types.ObjectId)
  assert.equal(selfBalance, 40)
  const l1Balance = await getBalanceAmount(l1._id as mongoose.Types.ObjectId)
  assert.equal(Number(l1Balance.toFixed(4)), Number((40 * DEPOSIT_L1_PERCENT).toFixed(4)))
  const l2Balance = await getBalanceAmount(l2._id as mongoose.Types.ObjectId)
  assert.equal(l2Balance, 0)

  const l2Payouts = await BonusPayout.countDocuments({ type: "DEPOSIT_L2", receiverUserId: l2._id })
  assert.equal(l2Payouts, 0)
})

test("active depositor generates full referral bonuses", async () => {
  const { member, l1, l2 } = await setupReferralChain()
  const activation = await approveDeposit(member._id as mongoose.Types.ObjectId, ACTIVE_DEPOSIT_THRESHOLD)
  const second = await approveDeposit(member._id as mongoose.Types.ObjectId, 200)

  assert.equal(second.outcome.depositorActive, true)

  const activationPayouts = await BonusPayout.find({
    sourceTxId: toHex(activation.transaction._id),
  })
    .sort({ type: 1 })
    .lean()

  const activationMap = Object.fromEntries(
    activationPayouts.map((payout) => [payout.type, Number((payout.payoutAmount ?? 0).toFixed(4))]),
  ) as Record<string, number>

  assert.equal(
    activationMap.DEPOSIT_BONUS_SELF,
    Number((ACTIVE_DEPOSIT_THRESHOLD * DEPOSIT_SELF_PERCENT_ACTIVE).toFixed(4)),
  )
  assert.equal(activationMap.DEPOSIT_L1, Number((ACTIVE_DEPOSIT_THRESHOLD * DEPOSIT_L1_PERCENT).toFixed(4)))
  assert.equal(
    activationMap.DEPOSIT_L2,
    Number((ACTIVE_DEPOSIT_THRESHOLD * DEPOSIT_L2_PERCENT_ACTIVE).toFixed(4)),
  )

  const secondPayouts = await BonusPayout.find({
    sourceTxId: toHex(second.transaction._id),
  })
    .sort({ type: 1 })
    .lean()

  const secondMap = Object.fromEntries(
    secondPayouts.map((payout) => [payout.type, Number((payout.payoutAmount ?? 0).toFixed(4))]),
  ) as Record<string, number>

  assert.equal(secondMap.DEPOSIT_BONUS_SELF, Number((200 * DEPOSIT_SELF_PERCENT_ACTIVE).toFixed(4)))
  assert.equal(secondMap.DEPOSIT_L1, Number((200 * DEPOSIT_L1_PERCENT).toFixed(4)))
  assert.equal(secondMap.DEPOSIT_L2, Number((200 * DEPOSIT_L2_PERCENT_ACTIVE).toFixed(4)))
})

test("active depositor with no uplines receives only self bonus", async () => {
  const user = await createUser({ depositTotal: ACTIVE_DEPOSIT_THRESHOLD, isActive: true })
  const { outcome } = await approveDeposit(user._id as mongoose.Types.ObjectId, 100)

  assert.equal(outcome.depositorActive, true)
  const payouts = await BonusPayout.find({ payerUserId: user._id }).lean()
  assert.equal(payouts.length, 1)
  assert.equal(payouts[0]?.type, "DEPOSIT_BONUS_SELF")
  assert.equal(Number(payouts[0]?.payoutAmount ?? 0), Number((100 * DEPOSIT_SELF_PERCENT_ACTIVE).toFixed(4)))
})

test("team earnings create claimable payouts and can be claimed", async () => {
  const { member, l1, l2 } = await setupReferralChain()

  const earningTx = await Transaction.create({
    userId: member._id,
    type: "earn",
    amount: 300,
    status: "approved",
    meta: { source: "daily" },
  })

  await createTeamEarningPayouts(toHex(member._id), 300, {
    earningTransactionId: toHex(earningTx._id),
    earningAt: earningTx.createdAt,
  })

  const pendingL1 = await getPendingTeamEarnings(toHex(l1._id))
  const pendingL2 = await getPendingTeamEarnings(toHex(l2._id))
  assert.equal(pendingL1.length, 1)
  assert.equal(pendingL2.length, 1)
  assert.equal(Number(pendingL1[0]?.payoutAmount ?? 0), Number((300 * TEAM_EARN_L1_PERCENT).toFixed(4)))
  assert.equal(Number(pendingL2[0]?.payoutAmount ?? 0), Number((300 * TEAM_EARN_L2_PERCENT).toFixed(4)))

  const l1Claim = await claimTeamEarningPayouts(toHex(l1._id))
  assert.equal(l1Claim.claimedTotal, Number((300 * TEAM_EARN_L1_PERCENT).toFixed(4)))
  const l2Claim = await claimTeamEarningPayouts(toHex(l2._id))
  assert.equal(l2Claim.claimedTotal, Number((300 * TEAM_EARN_L2_PERCENT).toFixed(4)))

  const l1Balance = await Balance.findOne({ userId: l1._id })
  assert.ok(l1Balance)
  assert.equal(
    Number(l1Balance.current.toFixed(4)),
    Number((300 * TEAM_EARN_L1_PERCENT).toFixed(4)),
  )
})

test("deposit and earning payouts are idempotent", async () => {
  const { member, l1 } = await (async () => {
    const chain = await setupReferralChain()
    return { member: chain.member, l1: chain.l1 }
  })()

  const depositResult = await approveDeposit(member._id as mongoose.Types.ObjectId, 100)
  const originalPayouts = await BonusPayout.find({ payerUserId: member._id }).lean()
  const originalSum = originalPayouts.reduce((total, payout) => total + Number(payout.payoutAmount ?? 0), 0)

  await applyDepositRewards(toHex(member._id), 100, {
    depositTransactionId: toHex(depositResult.transaction._id),
    depositAt: depositResult.transaction.createdAt,
  })

  const duplicatePayouts = await BonusPayout.find({ payerUserId: member._id }).lean()
  const duplicateSum = duplicatePayouts.reduce((total, payout) => total + Number(payout.payoutAmount ?? 0), 0)
  assert.equal(duplicatePayouts.length, originalPayouts.length)
  assert.equal(Number(duplicateSum.toFixed(4)), Number(originalSum.toFixed(4)))

  const earningTx = await Transaction.create({
    userId: member._id,
    type: "earn",
    amount: 150,
    status: "approved",
    meta: { source: "daily" },
  })

  await createTeamEarningPayouts(toHex(member._id), 150, {
    earningTransactionId: toHex(earningTx._id),
    earningAt: earningTx.createdAt,
  })
  await createTeamEarningPayouts(toHex(member._id), 150, {
    earningTransactionId: toHex(earningTx._id),
    earningAt: earningTx.createdAt,
  })

  const pending = await getPendingTeamEarnings(toHex(l1._id))
  assert.equal(pending.length, 1)
  assert.equal(
    Number(pending[0]?.payoutAmount ?? 0),
    Number((150 * TEAM_EARN_L1_PERCENT).toFixed(4)),
  )
})

/**
 * G. L2 Conditionality:
 * First deposit below activation threshold => L2 gets 0%.
 * After user becomes Active, next deposit => L2 gets 3%.
 */
test("L2 conditionality respects depositor status at time of deposit", async () => {
  const { member, l1, l2 } = await setupReferralChain()

  // First deposit: 50 (lifetime < 80) => Inactive for this deposit
  const first = await approveDeposit(member._id as mongoose.Types.ObjectId, 50)
  assert.equal(first.outcome.depositorActive, false)

  const firstPayouts = await BonusPayout.find({ sourceTxId: toHex(first.transaction._id) }).lean()
  const firstTypes = new Set(firstPayouts.map((p) => p.type))
  assert.ok(firstTypes.has("DEPOSIT_L1"))
  assert.ok(!firstTypes.has("DEPOSIT_L2"))
  assert.equal(
    Number(firstPayouts.find((p) => p.type === "DEPOSIT_L1")?.payoutAmount?.toFixed(4) ?? 0),
    Number((50 * DEPOSIT_L1_PERCENT).toFixed(4)),
  )

  // Second deposit: 100 (lifetime is now 150) => Active for this deposit
  const second = await approveDeposit(member._id as mongoose.Types.ObjectId, 100)
  assert.equal(second.outcome.depositorActive, true)

  const secondPayouts = await BonusPayout.find({ sourceTxId: toHex(second.transaction._id) }).lean()
  const byType = Object.fromEntries(
    secondPayouts.map((p) => [p.type, Number((p.payoutAmount ?? 0).toFixed(4))]),
  ) as Record<string, number>

  assert.equal(byType.DEPOSIT_BONUS_SELF, Number((100 * DEPOSIT_SELF_PERCENT_ACTIVE).toFixed(4)))
  assert.equal(byType.DEPOSIT_L1, Number((100 * DEPOSIT_L1_PERCENT).toFixed(4)))
  assert.equal(byType.DEPOSIT_L2, Number((100 * DEPOSIT_L2_PERCENT_ACTIVE).toFixed(4)))

  // Ensure L2 total came only from the second deposit
  const l2Total = await sumPayouts({ type: "DEPOSIT_L2", receiverUserId: l2._id })
  assert.equal(Number(l2Total.toFixed(4)), Number((100 * DEPOSIT_L2_PERCENT_ACTIVE).toFixed(4)))
})
