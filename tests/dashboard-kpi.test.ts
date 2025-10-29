import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import mongoose from "mongoose"

process.env.SEED_IN_MEMORY = "true"

import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Transaction from "@/models/Transaction"
import { getDailyTeamRewardTotal } from "@/app/api/dashboard/route"

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

test("getDailyTeamRewardTotal sums the previous UTC day rewards", async () => {
  const user = await createUser()
  const otherUser = await createUser()
  const createdTransactionIds: mongoose.Types.ObjectId[] = []

  try {
    const rewardWithDay = await Transaction.create({
      userId: user._id,
      type: "teamReward",
      amount: 0.12,
      status: "approved",
      claimable: true,
      meta: { source: "daily_team_earning", day: "2025-10-11", uniqueEventId: randomUUID(), team: "A" },
      createdAt: new Date("2025-10-11T23:59:59Z"),
      updatedAt: new Date("2025-10-11T23:59:59Z"),
    } as any)
    createdTransactionIds.push(rewardWithDay._id as mongoose.Types.ObjectId)

    const rewardWithoutDay = await Transaction.create({
      userId: user._id,
      type: "teamReward",
      amount: 0.05,
      status: "approved",
      claimable: true,
      meta: { source: "daily_team_earning", uniqueEventId: randomUUID(), team: "A" },
      createdAt: new Date("2025-10-11T18:30:00Z"),
      updatedAt: new Date("2025-10-11T18:30:00Z"),
    } as any)
    createdTransactionIds.push(rewardWithoutDay._id as mongoose.Types.ObjectId)

    const otherUserReward = await Transaction.create({
      userId: otherUser._id,
      type: "teamReward",
      amount: 0.99,
      status: "approved",
      claimable: true,
      meta: { source: "daily_team_earning", day: "2025-10-11", uniqueEventId: randomUUID(), team: "B" },
      createdAt: new Date("2025-10-11T23:00:00Z"),
      updatedAt: new Date("2025-10-11T23:00:00Z"),
    } as any)
    createdTransactionIds.push(otherUserReward._id as mongoose.Types.ObjectId)

    const previousDayReward = await Transaction.create({
      userId: user._id,
      type: "teamReward",
      amount: 0.3,
      status: "approved",
      claimable: true,
      meta: { source: "daily_team_earning", day: "2025-10-10", uniqueEventId: randomUUID(), team: "A" },
      createdAt: new Date("2025-10-10T23:59:59Z"),
      updatedAt: new Date("2025-10-10T23:59:59Z"),
    } as any)
    createdTransactionIds.push(previousDayReward._id as mongoose.Types.ObjectId)

    const total = await getDailyTeamRewardTotal(
      user._id as mongoose.Types.ObjectId,
      new Date("2025-10-12T12:00:00Z"),
    )

    assert.equal(Number(total.toFixed(2)), 0.17)
  } finally {
    if (createdTransactionIds.length > 0) {
      await Transaction.deleteMany({ _id: { $in: createdTransactionIds } })
    }
    await User.deleteMany({ _id: { $in: [user._id, otherUser._id] } })
  }
})
