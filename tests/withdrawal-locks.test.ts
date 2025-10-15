import assert from "node:assert/strict"
import test from "node:test"

import {
  getWithdrawableBalance,
  partitionLotsByMaturity,
  resolveCapitalLockWindow,
  calculateWithdrawableSnapshot,
  normaliseAmount,
  type LockedCapitalLot,
} from "../lib/utils/locked-capital"

type BalanceLike = {
  current: number
  lockedCapitalLots?: LockedCapitalLot[]
}

function attemptWithdrawal(balance: BalanceLike, amount: number, asOf: Date) {
  const withdrawable = getWithdrawableBalance(balance, asOf)
  return {
    allowed: amount <= withdrawable,
    withdrawable,
  }
}

test("withdrawal is blocked while capital remains locked", () => {
  const lockStart = new Date("2024-01-01T00:00:00Z")
  const lockEnd = new Date("2024-02-01T00:00:00Z")

  const balance: BalanceLike = {
    current: 1000,
    lockedCapitalLots: [
      {
        amount: 600,
        lockStart,
        lockEnd,
        released: false,
      },
    ],
  }

  const asOf = new Date("2024-01-15T00:00:00Z")
  const { allowed, withdrawable } = attemptWithdrawal(balance, 500, asOf)

  assert.equal(withdrawable, 400, "locked capital should reduce withdrawable funds")
  assert.equal(allowed, false, "withdrawals above withdrawable balance must be blocked")
})

test("withdrawal succeeds once the lock period expires", () => {
  const lockStart = new Date("2024-01-01T00:00:00Z")
  const lockEnd = new Date("2024-02-01T00:00:00Z")

  const balance: BalanceLike = {
    current: 1000,
    lockedCapitalLots: [
      {
        amount: 600,
        lockStart,
        lockEnd,
        released: false,
      },
    ],
  }

  const asOf = new Date("2024-02-02T00:00:00Z")
  const { allowed, withdrawable } = attemptWithdrawal(balance, 500, asOf)

  assert.equal(withdrawable, 1000, "fully matured capital should be withdrawable")
  assert.equal(allowed, true, "withdrawal should succeed after lock end")
})

test("matured lots are separated from pending locks", () => {
  const now = new Date("2024-03-01T00:00:00Z")
  const lots: LockedCapitalLot[] = [
    {
      amount: 100,
      lockStart: new Date("2024-01-01T00:00:00Z"),
      lockEnd: new Date("2024-02-01T00:00:00Z"),
      released: false,
    },
    {
      amount: 200,
      lockStart: new Date("2024-02-01T00:00:00Z"),
      lockEnd: new Date("2024-04-01T00:00:00Z"),
      released: false,
    },
  ]

  const { matured, pending } = partitionLotsByMaturity(lots, now)

  assert.equal(matured.length, 1, "one lot should have matured")
  assert.equal(matured[0]?.amount, 100)
  assert.equal(pending.length, 1, "one lot should remain locked")
  assert.equal(pending[0]?.amount, 200)
})

test("capital lock window honors configured duration", () => {
  const now = new Date("2024-05-01T00:00:00Z")
  const { lockStart, lockEnd } = resolveCapitalLockWindow(
    { gating: { capitalLockDays: 10 } },
    now,
  )

  assert.equal(lockStart.getTime(), now.getTime(), "lock should start immediately")
  const expectedEnd = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000)
  assert.equal(lockEnd.getTime(), expectedEnd.getTime(), "lock end should respect settings")
})

test("withdrawable snapshot reconciles locked capital discrepancies", () => {
  const now = new Date("2024-06-01T00:00:00Z")
  const snapshot = calculateWithdrawableSnapshot(
    {
      current: 1000,
      lockedCapital: 250,
      pendingWithdraw: 150.236,
      lockedCapitalLots: [
        {
          amount: 200,
          lockStart: new Date("2024-05-01T00:00:00Z"),
          lockEnd: new Date("2024-07-01T00:00:00Z"),
          released: false,
        },
      ],
    },
    now,
  )

  assert.equal(snapshot.lockedAmount, 250, "locked capital field should be honored when greater than lot sum")
  assert.equal(snapshot.withdrawable, 750, "withdrawable balance should subtract the reconciled locked amount")
  assert.equal(snapshot.pendingWithdraw, 150.24, "pending withdraw should be normalised to cents")
})

test("normaliseAmount rounds to the nearest cent", () => {
  assert.equal(normaliseAmount(123.4567), 123.46)
  assert.equal(normaliseAmount(50), 50)
  assert.equal(normaliseAmount(Number.NaN), 0)
})
