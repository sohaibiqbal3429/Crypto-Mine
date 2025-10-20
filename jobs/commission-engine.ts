import "dotenv/config"

import { runDailyCommissionEngine, runMonthlyBonusCycle } from "@/lib/services/commission-engine"

async function main() {
  const [, , mode] = process.argv
  const now = new Date()

  if (mode === "monthly") {
    await runMonthlyBonusCycle(now)
    console.log(`[commission-engine] Monthly bonus cycle completed for ${now.toISOString()}`)
    return
  }

  await runDailyCommissionEngine(now)
  console.log(`[commission-engine] Daily commission cycle completed for ${now.toISOString()}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[commission-engine] Worker failed", error)
    process.exit(1)
  })
