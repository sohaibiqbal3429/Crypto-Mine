import assert from "node:assert/strict"
import { randomUUID } from "crypto"
import test from "node:test"

process.env.SEED_IN_MEMORY = "true"

import dbConnect from "@/lib/mongodb"
import {
  payDailyTeamProfit,
  payDirectDepositCommission,
  payMonthlyBonuses,
  payTeamDepositCommissions,
  refreshAllUserLevels,
} from "@/lib/services/commission-engine"
import { applyDepositRewards } from "@/lib/utils/commission"
import Balance from "@/models/Balance"
import Payout from "@/models/Payout"
import TeamDailyProfit from "@/models/TeamDailyProfit"
import Transaction from "@/models/Transaction"
import User from "@/models/User"

test.before(async () => {
  await dbConnect()
})

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

const toId = (value: unknown) =>
  typeof value === "string" ? value : (value as { toString?: () => string })?.toString?.() ?? ""

test("L1 direct commission and team profit payouts are applied once", { concurrency: false }, async () => {
  const sponsor = await createUser()
  const directUsers = await Promise.all(
    Array.from({ length: 5 }, async () =>
      createUser({
        referredBy: sponsor._id,
        depositTotal: 100,
        qualified: true,
        qualifiedAt: new Date("2025-10-01T00:00:00Z"),
      }),
    ),
  )

  await Balance.create({
    userId: sponsor._id,
    current: 0,
    totalBalance: 0,
    totalEarning: 0,
    teamRewardsAvailable: 0,
    teamRewardsClaimed: 0,
  } as any)

  await refreshAllUserLevels(new Date("2025-10-10T00:00:00Z"))

  const deposit = await Transaction.create({
    userId: directUsers[0]._id,
    type: "deposit",
    amount: 100,
    status: "approved",
    createdAt: new Date("2025-10-10T12:00:00Z"),
    updatedAt: new Date("2025-10-10T12:00:00Z"),
  } as any)

  const firstPayout = await payDirectDepositCommission(toId(deposit._id))
  assert.ok(firstPayout)
  assert.equal(firstPayout?.amount, 7)
  assert.equal(firstPayout?.created, true)

  const duplicate = await payDirectDepositCommission(toId(deposit._id))
  assert.ok(duplicate)
  assert.equal(duplicate?.created, false)

  let sponsorBalance = await Balance.findOne({ userId: sponsor._id })
  assert.ok(sponsorBalance)
  assert.equal(Number(sponsorBalance?.current ?? 0), 7)
  assert.equal(Number(sponsorBalance?.teamRewardsAvailable ?? 0), 0)

  await TeamDailyProfit.create({
    memberId: directUsers[0]._id,
    profitDate: new Date("2025-10-11T12:00:00Z"),
    profitAmount: 10,
    activeOnDate: true,
  })

  const profitResults = await payDailyTeamProfit(new Date("2025-10-12T00:00:00Z"))
  const sponsorResult = profitResults.find((entry) => entry.userId === toId(sponsor._id))
  assert.ok(sponsorResult)
  assert.equal(sponsorResult?.amount, 0.1)
  assert.equal(sponsorResult?.totalTeamProfit, 10)

  const payout = await Payout.findOne({ uniqueKey: "TDP:2025-10-11:" + toId(sponsor._id) })
  assert.ok(payout)
  assert.equal(payout?.amount, 0.1)
  assert.equal(payout?.type, "team_profit")

  sponsorBalance = await Balance.findOne({ userId: sponsor._id })
  assert.ok(sponsorBalance)
  assert.equal(Number(sponsorBalance?.teamRewardsAvailable ?? 0), 0.1)
  assert.equal(Number(sponsorBalance?.current ?? 0), 7)
})

test("L2 team profit payout covers generations A-C", { concurrency: false }, async () => {
  const sponsor = await createUser()
  const teamA = await Promise.all(
    Array.from({ length: 10 }, async (_, index) =>
      createUser({
        referredBy: sponsor._id,
        depositTotal: 120,
        qualified: true,
        qualifiedAt: new Date("2025-10-0" + ((index % 3) + 1) + "T00:00:00Z"),
      }),
    ),
  )

  const teamB = await createUser({
    referredBy: teamA[0]._id,
    depositTotal: 150,
    qualified: true,
    qualifiedAt: new Date("2025-10-05T00:00:00Z"),
  })

  const teamC = await createUser({
    referredBy: teamB._id,
    depositTotal: 200,
    qualified: true,
    qualifiedAt: new Date("2025-10-06T00:00:00Z"),
  })

  await refreshAllUserLevels(new Date("2025-10-11T00:00:00Z"))

  await Promise.all([
    ...teamA.slice(0, 4).map((member) =>
      TeamDailyProfit.create({
        memberId: member._id,
        profitDate: new Date("2025-10-11T08:00:00Z"),
        profitAmount: 10,
        activeOnDate: true,
      }),
    ),
    TeamDailyProfit.create({
      memberId: teamB._id,
      profitDate: new Date("2025-10-11T08:00:00Z"),
      profitAmount: 20,
      activeOnDate: true,
    }),
    TeamDailyProfit.create({
      memberId: teamC._id,
      profitDate: new Date("2025-10-11T08:00:00Z"),
      profitAmount: 10,
      activeOnDate: true,
    }),
  ])

  const results = await payDailyTeamProfit(new Date("2025-10-12T00:00:00Z"))
  const sponsorResult = results.find((entry) => entry.userId === toId(sponsor._id))
  assert.ok(sponsorResult)
  assert.equal(sponsorResult?.amount, 0.7)
  assert.equal(sponsorResult?.totalTeamProfit, 70)
})

test("L3 sponsors receive team deposit commission from depth A-D", { concurrency: false }, async () => {
  const sponsor = await createUser()
  const teamA = await Promise.all(
    Array.from({ length: 15 }, async () =>
      createUser({
        referredBy: sponsor._id,
        depositTotal: 100,
        qualified: true,
        qualifiedAt: new Date("2025-09-15T00:00:00Z"),
      }),
    ),
  )

  const teamB = await createUser({
    referredBy: teamA[0]._id,
    depositTotal: 120,
    qualified: true,
    qualifiedAt: new Date("2025-09-16T00:00:00Z"),
  })

  const teamC = await createUser({
    referredBy: teamB._id,
    depositTotal: 140,
    qualified: true,
    qualifiedAt: new Date("2025-09-17T00:00:00Z"),
  })

  await refreshAllUserLevels(new Date("2025-09-18T00:00:00Z"))

  const deposit = await Transaction.create({
    userId: teamC._id,
    type: "deposit",
    amount: 500,
    status: "approved",
    createdAt: new Date("2025-09-18T10:00:00Z"),
    updatedAt: new Date("2025-09-18T10:00:00Z"),
  } as any)

  const outcomes = await payTeamDepositCommissions(toId(deposit._id))
  assert.equal(outcomes.length, 1)
  assert.equal(outcomes[0]?.amount, 40)
  assert.equal(outcomes[0]?.created, true)
})

test("first qualifying deposit awards a single $2 credit", { concurrency: false }, async () => {
  const user = await createUser()
  const userId = toId(user._id)

  await Balance.create({
    userId: user._id,
    current: 0,
    totalBalance: 0,
    totalEarning: 0,
    teamRewardsAvailable: 0,
    teamRewardsClaimed: 0,
  } as any)

  const firstResult = await applyDepositRewards(userId, 100)
  assert.equal(firstResult.depositCommission, 2)

  let balance = await Balance.findOne({ userId: user._id })
  assert.ok(balance)
  assert.equal(Number(balance?.current ?? 0), 2)
  assert.equal(Number(balance?.totalBalance ?? 0), 2)
  assert.equal(Number(balance?.totalEarning ?? 0), 2)

  let commissionTxs = await Transaction.find({
    userId: user._id,
    type: "commission",
    "meta.source": "deposit_commission",
  })
  assert.equal(commissionTxs.length, 1)
  assert.equal(Number(commissionTxs[0]?.amount ?? 0), 2)
  assert.equal(commissionTxs[0]?.meta?.fixedAmount, 2)

  const secondResult = await applyDepositRewards(userId, 150)
  assert.equal(secondResult.depositCommission, 0)

  balance = await Balance.findOne({ userId: user._id })
  assert.ok(balance)
  assert.equal(Number(balance?.current ?? 0), 2)
  assert.equal(Number(balance?.totalBalance ?? 0), 2)
  assert.equal(Number(balance?.totalEarning ?? 0), 2)

  commissionTxs = await Transaction.find({
    userId: user._id,
    type: "commission",
    "meta.source": "deposit_commission",
  })
  assert.equal(commissionTxs.length, 1)
})

test("Monthly bonuses pay out for L4 and L5 when thresholds met", { concurrency: false }, async () => {
  const l4Sponsor = await createUser()
  const l4Directs = await Promise.all(
    Array.from({ length: 23 }, async () =>
      createUser({
        referredBy: l4Sponsor._id,
        depositTotal: 100,
        qualified: true,
        qualifiedAt: new Date("2024-10-05T00:00:00Z"),
      }),
    ),
  )

  await refreshAllUserLevels(new Date("2024-10-31T00:00:00Z"))

  await Promise.all(
    l4Directs.slice(0, 5).map((member, index) =>
      Transaction.create({
        userId: member._id,
        type: "deposit",
        amount: 460,
        status: "approved",
        createdAt: new Date(`2024-10-${10 + index}T12:00:00Z`),
        updatedAt: new Date(`2024-10-${10 + index}T12:00:00Z`),
      } as any),
    ),
  )

  const l5Sponsor = await createUser()
  const l5Directs = await Promise.all(
    Array.from({ length: 30 }, async (_, index) =>
      createUser({
        referredBy: l5Sponsor._id,
        depositTotal: 150,
        qualified: true,
        qualifiedAt: new Date(`2024-09-${String((index % 10) + 10).padStart(2, "0")}T00:00:00Z`),
      }),
    ),
  )

  await refreshAllUserLevels(new Date("2024-10-31T00:00:00Z"))

  await Promise.all(
    l5Directs.slice(0, 10).map((member, index) =>
      Transaction.create({
        userId: member._id,
        type: "deposit",
        amount: 470,
        status: "approved",
        createdAt: new Date(`2024-10-${String(5 + index).padStart(2, "0")}T09:00:00Z`),
        updatedAt: new Date(`2024-10-${String(5 + index).padStart(2, "0")}T09:00:00Z`),
      } as any),
    ),
  )

  const outcomes = await payMonthlyBonuses(new Date("2024-11-01T00:00:00Z"))
  const l4Outcome = outcomes.find((outcome) => outcome.uniqueKey.includes(toId(l4Sponsor._id)))
  const l5Outcome = outcomes.find((outcome) => outcome.uniqueKey.includes(toId(l5Sponsor._id)))

  assert.ok(l4Outcome)
  assert.equal(l4Outcome?.amount, 200)
  assert.equal(l4Outcome?.created, true)

  assert.ok(l5Outcome)
  assert.equal(l5Outcome?.amount, 400)
  assert.equal(l5Outcome?.created, true)

  const duplicate = await payMonthlyBonuses(new Date("2024-11-01T00:00:00Z"))
  const l4Duplicate = duplicate.find((outcome) => outcome.uniqueKey.includes(toId(l4Sponsor._id)))
  const l5Duplicate = duplicate.find((outcome) => outcome.uniqueKey.includes(toId(l5Sponsor._id)))
  assert.ok(l4Duplicate)
  assert.equal(l4Duplicate?.created, false)
  assert.ok(l5Duplicate)
  assert.equal(l5Duplicate?.created, false)
})

test("Negative team profits do not generate payouts", { concurrency: false }, async () => {
  const sponsor = await createUser()
  const direct = await createUser({
    referredBy: sponsor._id,
    depositTotal: 100,
    qualified: true,
    qualifiedAt: new Date("2025-10-01T00:00:00Z"),
  })

  await refreshAllUserLevels(new Date("2025-10-11T00:00:00Z"))

  await TeamDailyProfit.create({
    memberId: direct._id,
    profitDate: new Date("2025-10-11T08:00:00Z"),
    profitAmount: -5,
    activeOnDate: true,
  })

  const results = await payDailyTeamProfit(new Date("2025-10-12T00:00:00Z"))
  const sponsorResult = results.find((entry) => entry.userId === toId(sponsor._id))
  assert.equal(sponsorResult, undefined)
})
