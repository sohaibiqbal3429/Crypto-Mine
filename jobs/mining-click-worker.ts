import "dotenv/config"

import { createMiningClickWorker } from "@/lib/queues/mining-clicks"
import { recordMiningMetrics } from "@/lib/services/mining-metrics"
import {
  markMiningStatusCompleted,
  markMiningStatusFailed,
  markMiningStatusProcessing,
} from "@/lib/services/mining-queue"
import { MiningActionError, performMiningClick } from "@/lib/services/mining"

createMiningClickWorker(async (job) => {
  const { idempotencyKey, userId } = job.data

  await markMiningStatusProcessing(idempotencyKey)

  try {
    const result = await performMiningClick(userId, { idempotencyKey })
    await markMiningStatusCompleted(idempotencyKey, userId, {
      ...result,
      message: "Mining rewarded",
      completedAt: new Date().toISOString(),
    })

    await recordMiningMetrics({
      processed: 1,
      profitTotal: result.profit,
      roiCapReached: result.roiCapReached ? 1 : 0,
    })

    return result
  } catch (error) {
    if (error instanceof MiningActionError) {
      await markMiningStatusFailed(
        idempotencyKey,
        userId,
        {
          message: error.message,
          retryable: error.status >= 500,
          details: (error as any).details,
        },
      )

      await recordMiningMetrics({ failed: 1 })
      if (error.status >= 500) {
        throw error
      }

      return { error: error.message }
    }

    await markMiningStatusFailed(idempotencyKey, userId, {
      message: "Unexpected mining error",
      retryable: true,
    })
    await recordMiningMetrics({ failed: 1 })

    throw error
  }
})
