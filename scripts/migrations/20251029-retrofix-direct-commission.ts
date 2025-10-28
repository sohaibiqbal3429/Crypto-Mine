import "dotenv/config"

import dbConnect from "@/lib/mongodb"
import { policyApplyRetroactiveAdjustments } from "@/lib/utils/commission"

async function run() {
  await dbConnect()
  const start = new Date(0)
  const end = new Date()
  console.log(`[retrofix] Applying direct-commission adjustments from ${start.toISOString()} to ${end.toISOString()}`)
  await policyApplyRetroactiveAdjustments({ start, end, adjustmentReason: "direct_pct_15_policy" })
  console.log("[retrofix] Done. Any prior 7% payouts are topped-up to 15% via adjust transactions.")
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[retrofix] Error:", err)
    process.exit(1)
  })

