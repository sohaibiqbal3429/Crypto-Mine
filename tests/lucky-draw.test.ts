import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test, { beforeEach, mock } from "node:test"
import mongoose from "mongoose"
import type { NextRequest } from "next/server"

import { initializeInMemoryDatabase } from "../lib/in-memory"
import * as auth from "../lib/auth"
import {
  ensureCurrentLuckyDrawRound,
  finalizeLuckyDrawRound,
  getLuckyDrawConfig,
  joinLuckyDrawRound,
  refundLuckyDrawEntry,
  updateLuckyDrawSettings,
  LuckyDrawServiceError,
} from "../lib/services/lucky-draw"
import Balance from "../models/Balance"
import LuckyDrawEntry from "../models/LuckyDrawEntry"
import LuckyDrawRound from "../models/LuckyDrawRound"
import Transaction from "../models/Transaction"
import User from "../models/User"
import * as joinRoute from "../app/api/lucky-draw/join/route"
import * as adminDrawRoute from "../app/api/admin/lucky-draw/round/[id]/draw/route"

process.env.NODE_ENV = process.env.NODE_ENV || "test"

async function resetInMemoryState() {
  delete (globalThis as any).__inMemoryDb
  delete (globalThis as any).__inMemoryDbInitialized
  ;(mongoose as any).models = {}
  ;(mongoose as any).modelSchemas = {}
  await initializeInMemoryDatabase()
  ;(globalThis as any).__inMemoryDbInitialized = true
}

beforeEach(async () => {
  await resetInMemoryState()
})

async function createTestUser({ balance = 100, role = "user" as "user" | "admin" } = {}) {
  const unique = randomUUID()
  const user = await User.create({
    email: `tester-${unique}@example.com`,
    passwordHash: "hashed",
    name: "Lucky Tester",
    role,
    referralCode: `REF-${unique.slice(0, 8)}`,
    isActive: true,
    emailVerified: true,
    phoneVerified: true,
    depositTotal: 0,
    withdrawTotal: 0,
    roiEarnedTotal: 0,
    level: 0,
    directActiveCount: 0,
    totalActiveDirects: 0,
    qualified: false,
    groups: { A: [], B: [], C: [], D: [] },
  })

  await Balance.create({
    userId: user._id,
    current: balance,
    totalBalance: balance,
    totalEarning: 0,
    lockedCapital: 0,
    lockedCapitalLots: [],
    staked: 0,
    pendingWithdraw: 0,
    teamRewardsAvailable: 0,
    teamRewardsClaimed: 0,
  })

  return user
}

async function createFreshRound() {
  await LuckyDrawRound.deleteMany({})
  await LuckyDrawEntry.deleteMany({})
  await Transaction.deleteMany({ type: { $in: ["luckyDrawEntry", "luckyDrawReward"] } })

  const config = await getLuckyDrawConfig()
  const startsAt = new Date()
  const endsAt = new Date(startsAt.getTime() + config.cycleHours * 60 * 60 * 1000)

  const created = await LuckyDrawRound.create({
    status: "open",
    startsAt,
    endsAt,
    entryFee: config.entryFee,
    prize: config.prize,
    totalEntries: 0,
  })

  const round = await LuckyDrawRound.findById(created._id)
  if (!round) {
    throw new Error("Failed to create test round")
  }

  const roundId = (round._id as any)?.toString?.() ?? ""
  assert.ok(roundId, "test round should have a string id")

  return { round, roundId, config }
}

function createRequest(body: unknown): NextRequest {
  return {
    headers: { get: () => null },
    cookies: { get: () => null },
    json: async () => body,
  } as unknown as NextRequest
}

test("joining a round deducts the entry fee and records participation", async () => {
  const { round, roundId, config } = await createFreshRound()
  const user = await createTestUser()
  const userId = (user._id as any).toString()
  const balanceBefore = await Balance.findOne({ userId: user._id })

  await joinLuckyDrawRound(userId, roundId)

  const balanceAfter = await Balance.findOne({ userId: user._id })
  assert.ok(balanceBefore && balanceAfter)
  assert.equal(
    balanceAfter.current,
    balanceBefore.current - config.entryFee,
    "entry fee should be deducted from current balance",
  )

  const entry = await LuckyDrawEntry.findOne({ roundId, userId })
  assert.ok(entry, "entry should be recorded")

  const transaction = await Transaction.findOne({
    userId: userId,
    type: "luckyDrawEntry",
    "meta.roundId": roundId,
  })
  assert.ok(transaction, "entry ledger transaction should be created")
})

test("duplicate joins are rejected after the first entry", async () => {
  const { roundId } = await createFreshRound()
  const user = await createTestUser({ balance: 50 })
  const userId = (user._id as any).toString()

  await joinLuckyDrawRound(userId, roundId)

  await assert.rejects(
    () => joinLuckyDrawRound(userId, roundId),
    (error: any) => error instanceof LuckyDrawServiceError && error.message === "You have already joined this round",
    "second join attempt should fail",
  )
})

test("finalizing a round credits the winner and stores payout metadata", async () => {
  const { round, roundId, config } = await createFreshRound()
  const userA = await createTestUser()
  const userB = await createTestUser()

  const userAId = (userA._id as any).toString()
  const userBId = (userB._id as any).toString()

  await joinLuckyDrawRound(userAId, roundId)
  await joinLuckyDrawRound(userBId, roundId)

  const balanceBeforeA = await Balance.findOne({ userId: userA._id })
  const balanceBeforeB = await Balance.findOne({ userId: userB._id })

  const completed = await finalizeLuckyDrawRound(roundId, {
    trigger: "manual",
    startNextRound: false,
  })

  if (!completed) {
    throw new Error("Round should exist after finalize")
  }

  assert.equal(completed.status, "completed")
  assert.ok(completed.winnerUserId)
  const winnerId = completed.winnerUserId?.toString()
  assert.ok(winnerId === userAId || winnerId === userBId)
  assert.ok(completed.payoutTxId, "payout transaction id should be stored")
  assert.ok(completed.winnerSnapshot, "winner snapshot should be persisted")

  const balanceAfterA = await Balance.findOne({ userId: userA._id })
  const balanceAfterB = await Balance.findOne({ userId: userB._id })
  assert.ok(balanceAfterA && balanceBeforeA && balanceAfterB && balanceBeforeB)

  const prizeDeltaA = balanceAfterA.current - balanceBeforeA.current
  const prizeDeltaB = balanceAfterB.current - balanceBeforeB.current

  assert.ok(
    [prizeDeltaA, prizeDeltaB].includes(config.prize),
    "winner should receive the prize amount",
  )
  assert.ok(
    [prizeDeltaA, prizeDeltaB].includes(0),
    "non-winning participant balance should remain unchanged after finalize",
  )

  const completedRoundId = String((completed as any)._id)
  const payoutTx = await Transaction.findOne({
    type: "luckyDrawReward",
    "meta.roundId": completedRoundId,
  })
  assert.ok(payoutTx, "payout ledger entry should be created")
})

test("refunds reimburse non-winning entries but block the winner", async () => {
  const { round, roundId, config } = await createFreshRound()
  const userA = await createTestUser()
  const userB = await createTestUser()

  const userAId = (userA._id as any).toString()
  const userBId = (userB._id as any).toString()

  await joinLuckyDrawRound(userAId, roundId)
  await joinLuckyDrawRound(userBId, roundId)

  const completed = await finalizeLuckyDrawRound(roundId, {
    trigger: "manual",
    startNextRound: false,
  })

  if (!completed) {
    throw new Error("Round should exist after finalize")
  }

  const entries = await LuckyDrawEntry.find({ roundId }).lean()
  assert.equal(entries.length, 2, "entries should remain for historical record")
  const winnerEntry = entries.find((entry) => entry.userId.toString() === completed.winnerUserId?.toString())
  const losingEntry = entries.find((entry) => entry.userId.toString() !== completed.winnerUserId?.toString())
  assert.ok(winnerEntry && losingEntry)

  await assert.rejects(
    () => refundLuckyDrawEntry(roundId, winnerEntry._id.toString()),
    (error: any) => error instanceof LuckyDrawServiceError && error.message === "Cannot refund the winning entry",
    "winner refund should be rejected",
  )

  const losingBalanceBefore = await Balance.findOne({ userId: losingEntry.userId })
  assert.ok(losingBalanceBefore)

  await refundLuckyDrawEntry(roundId, losingEntry._id.toString())

  const losingBalanceAfter = await Balance.findOne({ userId: losingEntry.userId })
  assert.ok(losingBalanceAfter)
  assert.equal(
    losingBalanceAfter.current,
    losingBalanceBefore.current + config.entryFee,
    "refund should restore the entry fee",
  )

  const refundedEntry = await LuckyDrawEntry.findById(losingEntry._id)
  assert.equal(refundedEntry, null, "refunded entry should be removed")
})

test("auto draw disabled keeps the expired round closed without completion", async () => {
  await updateLuckyDrawSettings({ autoDrawEnabled: false })
  await LuckyDrawRound.deleteMany({})

  const config = await getLuckyDrawConfig()
  const startsAt = new Date(Date.now() - 4 * 60 * 60 * 1000)
  const endsAt = new Date(Date.now() - 60 * 60 * 1000)
  const round = await LuckyDrawRound.create({
    status: "open",
    startsAt,
    endsAt,
    entryFee: config.entryFee,
    prize: config.prize,
    totalEntries: 0,
  })
  const seededRoundId = (round._id as any).toString()

  const { round: ensuredRound } = await ensureCurrentLuckyDrawRound()
  assert.equal(ensuredRound, null, "no active round should be returned while a closed round is pending")

  const updated = await LuckyDrawRound.findById(seededRoundId)
  assert.ok(updated)
  assert.equal(updated.status, "closed", "expired round should move to closed state")
  assert.equal(updated.winnerUserId ?? null, null, "round should not be completed automatically")
})

test("join API allows authenticated users to enter a round", async () => {
  const { roundId } = await createFreshRound()
  const user = await createTestUser()

  const userId = (user._id as any).toString()
  const authMock = mock.method(auth, "getUserFromRequest", () => ({
    userId,
    email: user.email,
    role: "user",
  }))

  const request = createRequest({ roundId })
  const response = await joinRoute.POST(request)
  const payload = (await response.json()) as any

  assert.equal(response.status, 200)
  assert.equal(payload.hasJoined, true)
  assert.equal(payload.totalEntries, 1)

  authMock.mock.restore()
})

test("join API rejects unauthenticated requests", async () => {
  const { roundId } = await createFreshRound()
  const authMock = mock.method(auth, "getUserFromRequest", () => null)

  const request = createRequest({ roundId })
  const response = await joinRoute.POST(request)
  assert.equal(response.status, 401)

  authMock.mock.restore()
})

test("admin draw endpoint finalizes a round when invoked by an admin", async () => {
  const { round, roundId } = await createFreshRound()
  const admin = await createTestUser({ role: "admin" })
  const participant = await createTestUser()
  const adminId = (admin._id as any).toString()
  const participantId = (participant._id as any).toString()
  await joinLuckyDrawRound(participantId, roundId)

  const authMock = mock.method(auth, "getUserFromRequest", () => ({
    userId: adminId,
    email: admin.email,
    role: "admin",
  }))

  const request = createRequest({})
  const response = await adminDrawRoute.POST(request, { params: { id: roundId } })
  const payload = (await response.json()) as any

  assert.equal(response.status, 200)
  assert.equal(payload.round.status, "completed")
  assert.equal(payload.round.id, roundId)
  assert.ok(payload.round.winnerUserId)

  authMock.mock.restore()
})

test("admin draw endpoint blocks non-admin users", async () => {
  const { roundId } = await createFreshRound()
  const user = await createTestUser()
  const userId = (user._id as any).toString()
  await joinLuckyDrawRound(userId, roundId)

  const authMock = mock.method(auth, "getUserFromRequest", () => ({
    userId,
    email: user.email,
    role: "user",
  }))

  const request = createRequest({})
  const response = await adminDrawRoute.POST(request, { params: { id: roundId } })
  assert.equal(response.status, 401)

  authMock.mock.restore()
})
