import assert from "node:assert/strict"
import test from "node:test"

process.env.SEED_IN_MEMORY = "true"

import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Balance from "@/models/Balance"
import TeamDailyProfit from "@/models/TeamDailyProfit"
import { performMiningClick } from "@/lib/services/mining"
import { runDailyTeamEarnings } from "@/lib/services/daily-team-earnings"
import { previewTeamEarnings } from "@/lib/services/team-earnings"

test("manual mining profit becomes claimable team reward", async () => {
  await dbConnect()

  const sponsor = await User.create({
    email: "sponsor@example.com",
    passwordHash: "hash",
    name: "Sponsor",
    role: "user",
    referralCode: "SPONSOR1",
    status: "active",
    depositTotal: 200,
    isActive: true,
  } as any)

  const member = await User.create({
    email: "member@example.com",
    passwordHash: "hash",
    name: "Member",
    role: "user",
    referralCode: "MEMBER001",
    status: "active",
    depositTotal: 120,
    isActive: true,
    referredBy: sponsor._id,
  } as any)

  await Balance.create({
    userId: sponsor._id,
    current: 0,
    totalBalance: 0,
    totalEarning: 0,
    teamRewardsAvailable: 0,
    teamRewardsClaimed: 0,
  } as any)

  await Balance.create({
    userId: member._id,
    current: 120,
    totalBalance: 120,
    totalEarning: 0,
  } as any)

  await performMiningClick((member._id as any).toString())

  const recordedProfitDoc = await TeamDailyProfit.findOne({ memberId: member._id })
  assert.ok(recordedProfitDoc)
  const recordedProfit =
    typeof (recordedProfitDoc as { toObject?: () => unknown }).toObject === "function"
      ? ((recordedProfitDoc as { toObject: () => unknown }).toObject() as { profitAmount?: unknown; activeOnDate?: unknown })
      : (recordedProfitDoc as { profitAmount?: unknown; activeOnDate?: unknown })
  assert.ok(Number(recordedProfit?.profitAmount ?? 0) > 0)
  assert.equal(Boolean(recordedProfit?.activeOnDate), true)

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  await runDailyTeamEarnings(tomorrow)

  const preview = await previewTeamEarnings((sponsor._id as any).toString())
  assert.ok(preview.available > 0)
})

