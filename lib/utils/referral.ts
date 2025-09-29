export function generateReferralCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let result = ""
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function calculateMiningProfit(baseAmount: number, minPct: number, maxPct: number): number {
  // Use a weighted random distribution favoring middle values
  const random1 = Math.random()
  const random2 = Math.random()
  const weightedRandom = (random1 + random2) / 2 // Creates a bell curve distribution

  const randomPct = weightedRandom * (maxPct - minPct) + minPct
  const profit = (baseAmount * randomPct) / 100

  // Round to 2 decimal places
  return Math.round(profit * 100) / 100
}

export function hasReachedROICap(earnedTotal: number, depositTotal: number, roiCap: number): boolean {
  return earnedTotal >= depositTotal * roiCap
}

export function calculateEstimatedDailyEarnings(baseAmount: number, minPct: number, maxPct: number): number {
  const avgPct = (minPct + maxPct) / 2
  return Math.round(((baseAmount * avgPct) / 100) * 100) / 100
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
