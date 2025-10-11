export function generateReferralCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let result = ""
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function calculateMiningProfit(baseAmount: number, minPct?: number, maxPct?: number): number {
  if (baseAmount <= 0) return 0

  const pct = typeof minPct === "number" && typeof maxPct === "number" ? (minPct + maxPct) / 2 : 1.5
  const appliedPct = pct || 1.5
  const profit = (baseAmount * appliedPct) / 100

  return Math.round(profit * 100) / 100
}

export function hasReachedROICap(earnedTotal: number, depositTotal: number, roiCap: number): boolean {
  return earnedTotal >= depositTotal * roiCap
}

export function calculateEstimatedDailyEarnings(baseAmount: number, minPct?: number, maxPct?: number): number {
  if (baseAmount <= 0) return 0
  const pct = typeof minPct === "number" && typeof maxPct === "number" ? (minPct + maxPct) / 2 : 1.5
  return Math.round(((baseAmount * (pct || 1.5)) / 100) * 100) / 100
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
