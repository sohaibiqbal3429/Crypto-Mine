import assert from "node:assert/strict"
import test from "node:test"

import {
  calculateWithdrawableSnapshot,
  getWithdrawableBalance,
  normaliseAmount,
  partitionLotsByMaturity,
} from "../lib/utils/locked-capital"

test("all wallet funds above the minimum are withdrawable", () => {
  const now = new Date("2024-07-01T00:00:00Z")
  const balance = {
    current: 842.58,
    totalEarning: 1200.25,
    pendingWithdraw: 100.12,
  }

  const snapshot = calculateWithdrawableSnapshot(balance, now)

  assert.equal(snapshot.withdrawable, 1200.25)
  assert.equal(snapshot.lockedAmount, 0)
  assert.equal(snapshot.pendingWithdraw, 100.12)
  assert.equal(getWithdrawableBalance(balance, now), 1200.25)
})

test("withdrawable balance is derived from total earnings, not current wallet", () => {
  const now = new Date("2024-07-01T00:00:00Z")
  const balance = {
    current: 212.92,
    totalEarning: 76.92,
    pendingWithdraw: 0,
  }

  const snapshot = calculateWithdrawableSnapshot(balance, now)

  assert.equal(snapshot.withdrawable, 76.92)
  assert.equal(snapshot.current, 212.92)
})

test("legacy locked lots no longer reduce withdrawable balance", () => {
  const now = new Date("2024-07-01T00:00:00Z")
  const balance = {
    current: 500,
    pendingWithdraw: 0,
    lockedCapital: 300,
    lockedCapitalLots: [
      {
        amount: 300,
        lockStart: new Date("2024-05-01T00:00:00Z"),
        lockEnd: new Date("2024-08-01T00:00:00Z"),
        released: false,
      },
    ],
  }

  const snapshot = calculateWithdrawableSnapshot(balance as any, now)

  assert.equal(snapshot.withdrawable, 500)
  assert.equal(snapshot.lockedAmount, 0)
})

test("partitionLotsByMaturity treats all lots as matured", () => {
  const lots = [
    {
      amount: 120,
      lockStart: new Date("2024-01-01T00:00:00Z"),
      lockEnd: new Date("2024-02-01T00:00:00Z"),
      released: false,
    },
    {
      amount: 80,
      lockStart: new Date("2024-03-01T00:00:00Z"),
      lockEnd: new Date("2024-04-01T00:00:00Z"),
      released: false,
    },
  ]

  const { matured, pending } = partitionLotsByMaturity(lots)

  assert.equal(matured.length, 2)
  assert.equal(pending.length, 0)
})

test("normaliseAmount rounds to the nearest cent", () => {
  assert.equal(normaliseAmount(123.4567), 123.46)
  assert.equal(normaliseAmount(50), 50)
  assert.equal(normaliseAmount(Number.NaN), 0)
})
