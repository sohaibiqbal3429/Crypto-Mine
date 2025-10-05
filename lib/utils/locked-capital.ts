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
  const lockedAmount = getLockedAmount(balance.lockedCapitalLots, asOf)
  return Math.max(0, balance.current - lockedAmount)
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
