import assert from "node:assert/strict"
import test from "node:test"
import mongoose from "mongoose"

process.env.SEED_IN_MEMORY = "true"

import dbConnect from "@/lib/mongodb"
import Balance from "@/models/Balance"
import TeamDailyProfit from "@/models/TeamDailyProfit"
import Transaction from "@/models/Transaction"
import User from "@/models/User"
import { runDailyTeamEarnings } from "@/lib/services/daily-team-earnings"
import LedgerEntry from "@/models/LedgerEntry"

async function createUser(overrides: Record<string, unknown> = {}) {
  await dbConnect()
  const random = Math.random().toString(36).slice(2)
  return User.create({
    email: `daily-${random}@example.com`,
    passwordHash: "hash",
    name: `Daily ${random}`,
    role: "user",
    referralCode: `daily-${random}`,
    status: "active",
    depositTotal: 0,
    ...overrides,
  } as any)
}

test.before(async () => {
  await dbConnect()
})

test("runDailyTeamEarnings pays team A and B for active members", { concurrency: false }, async () => {
  const leaderLeader = await createUser()
  const leader = await createUser({ referredBy: leaderLeader._id })
  const member = await createUser({ referredBy: leader._id })

  await User.updateOne({ _id: member._id }, { $set: { isActive: true } })

  await Transaction.deleteMany({})
  await Balance.deleteMany({})
  await TeamDailyProfit.deleteMany({})
  await LedgerEntry.deleteMany({})

  await TeamDailyProfit.create({
    memberId: member._id,
    profitDate: new Date("2025-01-02T12:00:00Z"),
    profitAmount: 100,
    activeOnDate: true,
  } as any)

  const summary = await runDailyTeamEarnings(new Date("2025-01-03T00:00:00Z"))
  assert.equal(summary.day, "2025-01-02")
  assert.equal(summary.postedCount, 2)
  assert.equal(summary.uniqueReceivers, 2)
  assert.equal(summary.totalReward, 2)

  const transactions = await Transaction.find({
    type: "teamReward",
    "meta.source": "daily_team_earning",
  }).lean()
  assert.equal(transactions.length, 2)

  const teamATx = transactions.find((tx) => toId(tx.userId) === toId(leader._id))
  const teamBTx = transactions.find((tx) => toId(tx.userId) === toId(leaderLeader._id))
  assert.ok(teamATx)
  assert.ok(teamBTx)
  assert.equal(Number(teamATx?.amount ?? 0), 1)
  assert.equal(Number(teamBTx?.amount ?? 0), 1)
  assert.equal(teamATx?.claimable, true)
  assert.equal(teamBTx?.claimable, true)
  assert.equal(teamATx?.meta?.team, "A")
  assert.equal(teamBTx?.meta?.team, "B")
  assert.equal(teamATx?.meta?.memberActive, true)
  assert.equal(teamBTx?.meta?.memberActive, true)

  const ledgerEntries = await LedgerEntry.find({ type: "daily_team_commission" }).lean()
  assert.equal(ledgerEntries.length, 2)
  const ledgerTeams = ledgerEntries.map((entry) => entry.meta?.team).sort()
  assert.deepEqual(ledgerTeams, ["A", "B"])

  const balances = await Balance.find().lean()
  const leaderBalance = balances.find((doc) => toId(doc.userId) === toId(leader._id))
  const leaderLeaderBalance = balances.find((doc) => toId(doc.userId) === toId(leaderLeader._id))
  assert.equal(Number(leaderBalance?.teamRewardsAvailable ?? 0), 1)
  assert.equal(Number(leaderLeaderBalance?.teamRewardsAvailable ?? 0), 1)

  const repeat = await runDailyTeamEarnings(new Date("2025-01-03T00:00:00Z"))
  assert.equal(repeat.postedCount, 0)
  assert.equal(repeat.totalReward, 0)
})

test("runDailyTeamEarnings skips team B when member inactive", { concurrency: false }, async () => {
  const leaderLeader = await createUser()
  const leader = await createUser({ referredBy: leaderLeader._id })
  const member = await createUser({ referredBy: leader._id })

  await Transaction.deleteMany({})
  await Balance.deleteMany({})
  await TeamDailyProfit.deleteMany({})
  await LedgerEntry.deleteMany({})

  await TeamDailyProfit.create({
    memberId: member._id,
    profitDate: new Date("2025-01-02T05:00:00Z"),
    profitAmount: 100,
    activeOnDate: false,
  } as any)

  const summary = await runDailyTeamEarnings(new Date("2025-01-03T00:00:00Z"))
  assert.equal(summary.postedCount, 2)
  assert.equal(summary.uniqueReceivers, 2)
  assert.equal(summary.totalReward, 2)

  const transactions = await Transaction.find({
    type: "teamReward",
    "meta.source": "daily_team_earning",
  }).lean()
  assert.equal(transactions.length, 2)

  const inactiveATx = transactions.find((tx) => toId(tx.userId) === toId(leader._id))
  const inactiveBTx = transactions.find((tx) => toId(tx.userId) === toId(leaderLeader._id))
  assert.ok(inactiveATx)
  assert.ok(inactiveBTx)
  assert.equal(inactiveATx?.meta?.memberActive, false)
  assert.equal(inactiveBTx?.meta?.memberActive, false)

  const inactiveLedger = await LedgerEntry.find({ type: "daily_team_commission" }).lean()
  assert.equal(inactiveLedger.length, 2)
})

test("runDailyTeamEarnings handles missing uplines", { concurrency: false }, async () => {
  const leader = await createUser()
  const member = await createUser({ referredBy: leader._id })

  await Transaction.deleteMany({})
  await Balance.deleteMany({})
  await TeamDailyProfit.deleteMany({})
  await LedgerEntry.deleteMany({})

  await TeamDailyProfit.create({
    memberId: member._id,
    profitDate: new Date("2025-03-02T12:00:00Z"),
    profitAmount: 10,
    activeOnDate: true,
  } as any)

  const summary = await runDailyTeamEarnings(new Date("2025-03-03T00:00:00Z"))
  assert.equal(summary.postedCount, 1)
  assert.equal(summary.uniqueReceivers, 1)

  const transactions = await Transaction.find({
    type: "teamReward",
    "meta.source": "daily_team_earning",
  }).lean()
  assert.equal(transactions.length, 1)
  assert.equal(toId(transactions[0]?.userId), toId(leader._id))
})
function toId(value: unknown): string {
  if (!value) return ""
  if (typeof value === "string") {
    if (mongoose.isValidObjectId(value)) {
      return new mongoose.Types.ObjectId(value).toHexString()
    }
    return value
  }
  if (value instanceof mongoose.Types.ObjectId) {
    return value.toHexString()
  }
  if (typeof (value as { toHexString?: () => string }).toHexString === "function") {
    return (value as { toHexString: () => string }).toHexString()
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    if (record._id) {
      return toId(record._id)
    }
    if (record.buffer && typeof record.buffer === "object") {
      const raw = record.buffer as Record<string, unknown>
      const entries = Object.keys(raw)
        .sort((a, b) => Number(a) - Number(b))
        .map((key) => Number(raw[key] ?? 0))
      if (entries.length === 12) {
        return Buffer.from(entries).toString("hex")
      }
    }
    try {
      return new mongoose.Types.ObjectId(value as any).toHexString()
    } catch (error) {
      // ignore and continue
    }
  }
  if (typeof (value as { toString?: () => string }).toString === "function") {
    const str = (value as { toString: () => string }).toString()
    if (str && str !== "[object Object]") {
      return str
    }
  }
  return JSON.stringify(value)
}

