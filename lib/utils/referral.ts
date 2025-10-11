export function generateReferralCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let result = ""
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

function resolveDailyMiningPct(minPct?: number, maxPct?: number): number {
  if (typeof minPct === "number" && !Number.isNaN(minPct) && minPct > 0) {
    return minPct
  }

  if (typeof maxPct === "number" && !Number.isNaN(maxPct) && maxPct > 0) {
    return maxPct
  }

  return 1.5
}

export function calculateMiningProfit(baseAmount: number, minPct?: number, maxPct?: number): number {
  if (baseAmount <= 0) return 0

  const pct = resolveDailyMiningPct(minPct, maxPct)
  const profit = (baseAmount * pct) / 100

  return Math.round(profit * 100) / 100
}

export function hasReachedROICap(earnedTotal: number, depositTotal: number, roiCap: number): boolean {
  return earnedTotal >= depositTotal * roiCap
}

export function calculateEstimatedDailyEarnings(baseAmount: number, minPct?: number, maxPct?: number): number {
  if (baseAmount <= 0) return 0
  const pct = resolveDailyMiningPct(minPct, maxPct)
  return Math.round(((baseAmount * pct) / 100) * 100) / 100
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
