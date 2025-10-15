import type { Types } from "mongoose"

export interface LockedCapitalLot {
  amount: number
  lockStart: Date
  lockEnd: Date
  released?: boolean
  releasedAt?: Date
  sourceTransactionId?: Types.ObjectId | string
}

export interface BalanceWithLockedLots {
  current: number
  lockedCapital?: number
  lockedCapitalLots?: LockedCapitalLot[]
  pendingWithdraw?: number
}

export interface WithdrawableSnapshot {
  asOf: Date
  current: number
  lockedAmount: number
  lockedAmountFromLots: number
  lockedCapitalField: number
  pendingWithdraw: number
  withdrawable: number
  withdrawableCents: number
  lockedAmountCents: number
  currentCents: number
  nextUnlockAt: Date | null
  activeLockedLots: LockedCapitalLot[]
}

function toCents(amount: number | null | undefined): number {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return 0
  }
  const normalised = Number.parseFloat(amount.toFixed(2))
  return Math.round(normalised * 100)
}

function fromCents(cents: number): number {
  if (!Number.isFinite(cents)) {
    return 0
  }
  return Number((cents / 100).toFixed(2))
}

export function normaliseAmount(amount: number | null | undefined): number {
  return fromCents(toCents(amount))
}

export interface LockSettingsLike {
  gating?: {
    capitalLockDays?: number
  }
}

export function resolveCapitalLockWindow(
  settings: LockSettingsLike | null | undefined,
  now = new Date(),
): { lockStart: Date; lockEnd: Date } {
  const lockDays = Number(settings?.gating?.capitalLockDays ?? 30)
  const lockStart = new Date(now)
  const lockEnd = new Date(lockStart.getTime() + lockDays * 24 * 60 * 60 * 1000)
  return { lockStart, lockEnd }
}

export function isLotReleased(lot: LockedCapitalLot, asOf = new Date()): boolean {
  if (lot.released) {
    return true
  }
  return lot.lockEnd.getTime() <= asOf.getTime()
}

export function getActiveLockedLots(lots: LockedCapitalLot[] | undefined | null, asOf = new Date()): LockedCapitalLot[] {
  if (!lots?.length) {
    return []
  }
  return lots.filter((lot) => !isLotReleased(lot, asOf))
}

export function getLockedAmount(lots: LockedCapitalLot[] | undefined | null, asOf = new Date()): number {
  return getActiveLockedLots(lots, asOf).reduce((sum, lot) => sum + lot.amount, 0)
}

export function getWithdrawableBalance(balance: BalanceWithLockedLots, asOf = new Date()): number {
  return calculateWithdrawableSnapshot(balance, asOf).withdrawable
}

export function calculateWithdrawableSnapshot(
  balance: BalanceWithLockedLots,
  asOf = new Date(),
): WithdrawableSnapshot {
  const currentCents = toCents(balance.current)
  const lockedCapitalField = normaliseAmount(balance.lockedCapital ?? 0)
  const lockedCapitalFieldCents = toCents(lockedCapitalField)

  const activeLots = getActiveLockedLots(balance.lockedCapitalLots, asOf)
  const lockedAmountFromLots = activeLots.reduce((sum, lot) => sum + normaliseAmount(lot.amount), 0)
  const lockedAmountFromLotsCents = toCents(lockedAmountFromLots)

  const lockedAmountCents = Math.max(lockedCapitalFieldCents, lockedAmountFromLotsCents)
  const withdrawableCents = Math.max(0, currentCents - lockedAmountCents)

  const nextUnlockAt = activeLots.reduce<Date | null>((earliest, lot) => {
    if (!lot.lockEnd) {
      return earliest
    }
    const lockEnd = new Date(lot.lockEnd)
    if (!earliest || lockEnd.getTime() < earliest.getTime()) {
      return lockEnd
    }
    return earliest
  }, null)

  const pendingWithdraw = normaliseAmount(balance.pendingWithdraw ?? 0)

  return {
    asOf,
    current: fromCents(currentCents),
    lockedAmount: fromCents(lockedAmountCents),
    lockedAmountFromLots: fromCents(lockedAmountFromLotsCents),
    lockedCapitalField: fromCents(lockedCapitalFieldCents),
    pendingWithdraw,
    withdrawable: fromCents(withdrawableCents),
    withdrawableCents,
    lockedAmountCents,
    currentCents,
    nextUnlockAt,
    activeLockedLots: activeLots.map((lot) => ({
      ...lot,
      lockStart: new Date(lot.lockStart),
      lockEnd: new Date(lot.lockEnd),
    })),
  }
}

export function partitionLotsByMaturity(
  lots: LockedCapitalLot[] | undefined | null,
  asOf = new Date(),
): { matured: LockedCapitalLot[]; pending: LockedCapitalLot[] } {
  if (!lots?.length) {
    return { matured: [], pending: [] }
  }

  return lots.reduce(
    (acc, lot) => {
      if (isLotReleased(lot, asOf)) {
        acc.matured.push(lot)
      } else {
        acc.pending.push(lot)
      }
      return acc
    },
    { matured: [] as LockedCapitalLot[], pending: [] as LockedCapitalLot[] },
  )
}
