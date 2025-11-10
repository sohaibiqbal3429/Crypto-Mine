import "dotenv/config"

import { getMiningQueueDepth, isMiningQueueEnabled } from "@/lib/queues/mining-clicks"
import { getMiningMetricsSnapshot } from "@/lib/services/mining-metrics"
import { isRedisEnabled } from "@/lib/redis"

async function main() {
  if (!isRedisEnabled() || !isMiningQueueEnabled()) {
    console.error("Mining queue is disabled. Ensure REDIS_URL is configured.")
    process.exit(1)
  }

  const depth = await getMiningQueueDepth()
  const metrics = await getMiningMetricsSnapshot()

  console.log("Mining queue depth:", depth)
  if (metrics) {
    console.log("Metrics snapshot:")
    console.table(metrics)
  } else {
    console.log("No metrics captured yet.")
  }
}

main().catch((error) => {
  console.error("Failed to inspect mining queue", error)
  process.exit(1)
})
