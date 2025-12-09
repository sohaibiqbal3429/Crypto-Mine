import assert from "node:assert/strict"
import { randomUUID } from "crypto"
import test from "node:test"

process.env.SEED_IN_MEMORY = "true"

import { depositSchema } from "@/lib/validations/wallet"
import {
  submitLuckyDrawDeposit,
  approveLuckyDrawDeposit,
  rejectLuckyDrawDeposit,
} from "@/lib/services/lucky-draw-deposits"
import { getActiveLuckyDrawRound, scheduleLuckyDrawWinner } from "@/lib/services/lucky-draw-rounds"
import LedgerEntry from "@/models/LedgerEntry"
import Balance from "@/models/Balance"
import User from "@/models/User"
import dbConnect from "@/lib/mongodb"

async function createUniqueUser(overrides: Record<string, unknown> = {}) {
  const unique = randomUUID()
  await dbConnect()
  const created = await User.create({
    email: `${unique}@example.com`,
    passwordHash: "test-hash",
    name: `Test User ${unique}`,
    role: "user",
    referralCode: unique.replace(/-/g, "").slice(0, 10),
    ...overrides,
  } as any)

  return Array.isArray(created) ? created[0] : created
}

const toId = (value: unknown) =>
  typeof value === "string" ? value : (value as { toString?: () => string })?.toString?.() ?? ""

test("wallet deposit schema enforces minimum $30 with two decimal precision", () => {
  const valid = depositSchema.safeParse({ amount: 30, transactionNumber: "0x".padEnd(66, "1"), network: "bep20" })
  assert.ok(valid.success, "$30 deposits should be accepted")

  const belowMinimum = depositSchema.safeParse({ amount: 29.99, transactionNumber: "0x".padEnd(66, "2"), network: "bep20" })
  assert.equal(belowMinimum.success, false, "amounts below $30 must be rejected")
  assert.equal(belowMinimum.error?.issues?.[0]?.message, "Amount must be at least $30.")

  const tooManyDecimals = depositSchema.safeParse({ amount: 30.123, transactionNumber: "0x".padEnd(66, "3"), network: "bep20" })
  assert.equal(tooManyDecimals.success, false, "amounts with more than two decimals must be rejected")
  assert.equal(tooManyDecimals.error?.issues?.[0]?.message, "Amount can have at most 2 decimal places.")
})

test("lucky draw deposit submission enforces receipt requirement and rate limit", async () => {
  const user = await createUniqueUser()

  await assert.rejects(
    submitLuckyDrawDeposit({
      userId: toId(user._id),
      transactionHash: randomUUID().replace(/-/g, ""),
      receiptUrl: "",
      receiptFile: null,
    }),
    /receipt/i,
    "Deposits without receipt should be rejected",
  )

  const hashes: string[] = []
  for (let index = 0; index < 3; index += 1) {
    const hash = randomUUID().replace(/-/g, "")
    hashes.push(hash)
    const deposit = await submitLuckyDrawDeposit({
      userId: toId(user._id),
      transactionHash: hash,
      receiptUrl: `https://example.com/receipt-${index}.png`,
    })
    assert.equal(deposit.status, "PENDING")
  }

  await assert.rejects(
    submitLuckyDrawDeposit({
      userId: toId(user._id),
      transactionHash: randomUUID().replace(/-/g, ""),
      receiptUrl: "https://example.com/receipt-final.png",
    }),
    /pending Lucky Draw deposits/i,
    "Fourth pending deposit should be blocked",
  )
})

test("approving a lucky draw deposit credits balance and writes ledger entry", async () => {
  const [user, admin] = await Promise.all([
    createUniqueUser(),
    createUniqueUser({ role: "admin" }),
  ])

  const deposit = await submitLuckyDrawDeposit({
    userId: toId(user._id),
    transactionHash: randomUUID().replace(/-/g, ""),
    receiptUrl: "https://example.com/receipt.png",
  })
  const approved = await approveLuckyDrawDeposit({
    adminId: toId(admin._id),
    depositId: toId(deposit._id),
  })

  assert.ok(approved, "deposit should be returned after approval")
  assert.equal(approved?.status, "APPROVED")

  const ledger = await LedgerEntry.findOne({ refId: deposit._id })
  assert.ok(ledger, "ledger entry should be created")
  assert.equal(ledger?.amount, 10)
  assert.equal(ledger?.type, "LUCKY_DRAW_DEPOSIT")

  const balance = await Balance.findOne({ userId: user._id })
  assert.ok(balance, "balance record should exist")
  assert.equal(balance?.luckyDrawCredits, 10)
})

test("rejecting a lucky draw deposit stores admin note without ledger entry", async () => {
  const [user, admin] = await Promise.all([
    createUniqueUser(),
    createUniqueUser({ role: "admin" }),
  ])

  const deposit = await submitLuckyDrawDeposit({
    userId: toId(user._id),
    transactionHash: randomUUID().replace(/-/g, ""),
    receiptUrl: "https://example.com/receipt.png",
  })

  const rejected = await rejectLuckyDrawDeposit({
    adminId: toId(admin._id),
    depositId: toId(deposit._id),
    note: "Hash mismatch",
  })

  assert.ok(rejected, "deposit should be returned after rejection")
  assert.equal(rejected?.status, "REJECTED")
  assert.equal(rejected?.adminNote, "Hash mismatch")

  const ledgerCount = await LedgerEntry.countDocuments({ refId: deposit._id })
  assert.equal(ledgerCount, 0, "ledger entry should not be created for rejected deposits")
})

test("scheduling a lucky draw winner persists selection", async () => {
  const [user, admin] = await Promise.all([
    createUniqueUser(),
    createUniqueUser({ role: "admin" }),
  ])

  const deposit = await submitLuckyDrawDeposit({
    userId: toId(user._id),
    transactionHash: randomUUID().replace(/-/g, ""),
    receiptUrl: "https://example.com/receipt.png",
  })
  await approveLuckyDrawDeposit({ adminId: toId(admin._id), depositId: toId(deposit._id) })

  const beforeRound = await getActiveLuckyDrawRound()
  assert.equal(beforeRound.selectedWinner, null, "no winner should be locked before scheduling")

  const scheduledRound = await scheduleLuckyDrawWinner({
    adminId: toId(admin._id),
    depositId: toId(deposit._id),
  })
  assert.equal(
    scheduledRound.selectedWinner?.depositId,
    toId(deposit._id),
    "scheduled winner should reference the approved deposit",
  )
  assert.ok(scheduledRound.selectedWinner?.selectedAt, "selection timestamp should be recorded")

  const persistedRound = await getActiveLuckyDrawRound()
  assert.equal(
    persistedRound.selectedWinner?.depositId,
    toId(deposit._id),
    "winner selection should persist after reloading the round",
  )
  assert.ok(persistedRound.announcementAtUtc, "announcement time should be scheduled")
})
