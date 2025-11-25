import "dotenv/config"

import { runDailyCommissionEngine, runMonthlyBonusCycle } from "@/lib/services/commission-engine"
import { runDailyMiningProfit } from "@/lib/services/daily-mining"

async function main() {
  const [, , mode] = process.argv
  const now = new Date()

  if (mode === "monthly") {
    await runMonthlyBonusCycle(now)
    console.log(`[commission-engine] Monthly bonus cycle completed for ${now.toISOString()}`)
    return
  }

  // First, post daily mining profits based on current balances
  await runDailyMiningProfit(now)
  // Then, compute team earnings from the posted daily profits
  await runDailyCommissionEngine(now)
  console.log(`[commission-engine] Daily commission cycle completed for ${now.toISOString()}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[commission-engine] Worker failed", error)
    process.exit(1)
  })
