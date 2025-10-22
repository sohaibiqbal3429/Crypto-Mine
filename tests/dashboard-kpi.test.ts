import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import mongoose from "mongoose"

process.env.SEED_IN_MEMORY = "true"

import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Payout from "@/models/Payout"
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

test("getDailyTeamRewardTotal sums the previous UTC day payouts", async () => {
  const user = await createUser()
  const otherUser = await createUser()
  const createdPayoutIds: mongoose.Types.ObjectId[] = []

  try {
    const payoutWithDay = await Payout.create({
      userId: user._id,
      type: "daily_team_earning",
      amount: 0.12,
      status: "completed",
      date: new Date("2025-10-11T23:59:59Z"),
      uniqueKey: randomUUID(),
      meta: { day: "2025-10-11" },
    } as any)
    createdPayoutIds.push(payoutWithDay._id as mongoose.Types.ObjectId)

    const payoutWithoutDay = await Payout.create({
      userId: user._id,
      type: "daily_team_earning",
      amount: 0.05,
      status: "completed",
      date: new Date("2025-10-11T18:30:00Z"),
      uniqueKey: randomUUID(),
    } as any)
    createdPayoutIds.push(payoutWithoutDay._id as mongoose.Types.ObjectId)

    const otherUserPayout = await Payout.create({
      userId: otherUser._id,
      type: "daily_team_earning",
      amount: 0.99,
      status: "completed",
      date: new Date("2025-10-11T23:00:00Z"),
      uniqueKey: randomUUID(),
      meta: { day: "2025-10-11" },
    } as any)
    createdPayoutIds.push(otherUserPayout._id as mongoose.Types.ObjectId)

    const previousDayPayout = await Payout.create({
      userId: user._id,
      type: "daily_team_earning",
      amount: 0.3,
      status: "completed",
      date: new Date("2025-10-10T23:59:59Z"),
      uniqueKey: randomUUID(),
      meta: { day: "2025-10-10" },
    } as any)
    createdPayoutIds.push(previousDayPayout._id as mongoose.Types.ObjectId)

    const total = await getDailyTeamRewardTotal(
      user._id as mongoose.Types.ObjectId,
      new Date("2025-10-12T12:00:00Z"),
    )

    assert.equal(Number(total.toFixed(2)), 0.17)
  } finally {
    if (createdPayoutIds.length > 0) {
      await Payout.deleteMany({ _id: { $in: createdPayoutIds } })
    }
    await User.deleteMany({ _id: { $in: [user._id, otherUser._id] } })
  }
})
