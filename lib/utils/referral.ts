import { fromScaledInteger, multiplyAmountByPercent, toScaledInteger } from "@/lib/utils/numeric"

const DEFAULT_DAILY_MINING_PERCENT = 1.5

export function generateReferralCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let result = ""
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

function resolveDailyMiningPct(minPct?: unknown, maxPct?: unknown): number {
  const minScaled = toScaledInteger(minPct, 2)
  if (minScaled !== null && minScaled > 0) {
    return fromScaledInteger(minScaled, 2)
  }

  const maxScaled = toScaledInteger(maxPct, 2)
  if (maxScaled !== null && maxScaled > 0) {
    return fromScaledInteger(maxScaled, 2)
  }

  return DEFAULT_DAILY_MINING_PERCENT
}

export function calculateMiningProfit(baseAmount: number, minPct?: unknown, maxPct?: unknown): number {
  if (typeof baseAmount !== "number" || !Number.isFinite(baseAmount) || baseAmount <= 0) {
    return 0
  }

  const pct = resolveDailyMiningPct(minPct, maxPct)
  return multiplyAmountByPercent(baseAmount, pct)
}

export function hasReachedROICap(earnedTotal: number, depositTotal: number, roiCap: number): boolean {
  return earnedTotal >= depositTotal * roiCap
}

export function calculateEstimatedDailyEarnings(baseAmount: number, minPct?: unknown, maxPct?: unknown): number {
  if (typeof baseAmount !== "number" || !Number.isFinite(baseAmount) || baseAmount <= 0) {
    return 0
  }

  const pct = resolveDailyMiningPct(minPct, maxPct)
  return multiplyAmountByPercent(baseAmount, pct)
}

export function calculateROIProgress(earnedTotal: number, depositTotal: number, roiCap: number): number {
  if (depositTotal === 0) return 0
  const maxEarnings = depositTotal * roiCap
  return Math.min((earnedTotal / maxEarnings) * 100, 100)
}

export function getRemainingROICapacity(earnedTotal: number, depositTotal: number, roiCap: number): number {
  const maxEarnings = depositTotal * roiCap
  return Math.max(maxEarnings - earnedTotal, 0)
}
