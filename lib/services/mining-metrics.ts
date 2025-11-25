import { getRedisClient, isRedisEnabled } from "@/lib/redis"

const METRICS_KEY = "mining:metrics"

export interface MiningMetricIncrements {
  processed?: number
  failed?: number
  profitTotal?: number
  roiCapReached?: number
}

export async function recordMiningMetrics(increments: MiningMetricIncrements): Promise<void> {
  if (!isRedisEnabled()) {
    return
  }

  const redis = getRedisClient()
  const pipeline = redis.pipeline()

  if (increments.processed) {
    pipeline.hincrby(METRICS_KEY, "processed", increments.processed)
  }

  if (increments.failed) {
    pipeline.hincrby(METRICS_KEY, "failed", increments.failed)
  }

  if (increments.profitTotal) {
    pipeline.hincrbyfloat(METRICS_KEY, "profitTotal", increments.profitTotal)
  }

  if (increments.roiCapReached) {
    pipeline.hincrby(METRICS_KEY, "roiCapReached", increments.roiCapReached)
  }

  pipeline.hset(METRICS_KEY, "updatedAt", new Date().toISOString())
  await pipeline.exec()
}

export async function getMiningMetricsSnapshot(): Promise<Record<string, string> | null> {
  if (!isRedisEnabled()) {
    return null
  }

  const redis = getRedisClient()
  const result = await redis.hgetall(METRICS_KEY)
  return Object.keys(result).length === 0 ? null : result
}
