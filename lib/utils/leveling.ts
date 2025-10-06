export const QUALIFYING_DIRECT_DEPOSIT = 80 as const

export const LEVEL_PROGRESS_REQUIREMENTS = [5, 10, 15, 23, 30] as const

export type LevelProgressRequirement = (typeof LEVEL_PROGRESS_REQUIREMENTS)[number]

export function getNextLevelRequirement(currentLevel: number): number | null {
  if (currentLevel >= LEVEL_PROGRESS_REQUIREMENTS.length) {
    return null
  }

  return LEVEL_PROGRESS_REQUIREMENTS[currentLevel]
}

interface QualifiableUserLike {
  qualified?: boolean | null
  depositTotal?: number | string | null
}

export function hasQualifiedDeposit(user: QualifiableUserLike | null | undefined): boolean {
  if (!user) {
    return false
  }

  if (user.qualified) {
    return true
  }

  const depositTotal = Number(user.depositTotal ?? 0)
  return Number.isFinite(depositTotal) && depositTotal >= QUALIFYING_DIRECT_DEPOSIT
}
