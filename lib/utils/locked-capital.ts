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

export interface BalanceSnapshotInput {
  current: number
  totalEarning?: number
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
  nextUnlockAt: null
  activeLockedLots: []
}

export function getWithdrawableBalance(balance: BalanceSnapshotInput, asOf = new Date()): number {
  return calculateWithdrawableSnapshot(balance, asOf).withdrawable
}

export function calculateWithdrawableSnapshot(
  balance: BalanceSnapshotInput,
  asOf = new Date(),
): WithdrawableSnapshot {
  const currentCents = toCents(balance.current)
  const totalEarningCents = toCents(balance.totalEarning ?? 0)
  const pendingWithdraw = normaliseAmount(balance.pendingWithdraw ?? 0)

  return {
    asOf,
    current: fromCents(currentCents),
    lockedAmount: 0,
    lockedAmountFromLots: 0,
    lockedCapitalField: 0,
    pendingWithdraw,
    withdrawable: fromCents(totalEarningCents),
    withdrawableCents: totalEarningCents,
    lockedAmountCents: 0,
    currentCents,
    nextUnlockAt: null,
    activeLockedLots: [],
  }
}

export interface LegacyLockedCapitalLot {
  amount: number
  lockStart: Date
  lockEnd: Date
  released?: boolean
  releasedAt?: Date
}

export function partitionLotsByMaturity(
  lots: LegacyLockedCapitalLot[] | undefined | null,
): { matured: LegacyLockedCapitalLot[]; pending: LegacyLockedCapitalLot[] } {
  if (!lots?.length) {
    return { matured: [], pending: [] }
  }

  // Capital locks are no longer enforced. Treat every lot as matured.
  return { matured: [...lots], pending: [] }
}
