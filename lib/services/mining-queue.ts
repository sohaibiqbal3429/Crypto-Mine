import { enqueueMiningClickJob, getMiningQueueDepth, isMiningQueueEnabled, type MiningClickJobData } from "@/lib/queues/mining-clicks"
import { getRedisClient, isRedisEnabled } from "@/lib/redis"

export const MINING_STATUS_TTL_MS = 1000 * 60 * 60 * 24 // 24 hours
export const MINING_FAILURE_TTL_MS = 1000 * 60 * 15 // 15 minutes for transient errors

export type MiningRequestState =
  | "queued"
  | "processing"
  | "completed"
  | "failed"

export interface MiningRequestStatus {
  status: MiningRequestState
  idempotencyKey: string
  userId: string
  requestedAt: string
  updatedAt: string
  sourceIp?: string | null
  userAgent?: string | null
  queueDepth?: number
  result?: Record<string, unknown>
  error?: {
    message: string
    retryable?: boolean
    retryAfterMs?: number
    code?: string
    details?: Record<string, unknown>
  }
}

function getStatusKey(idempotencyKey: string): string {
  return `mining:idemp:${idempotencyKey}`
}

export async function getMiningRequestStatus(idempotencyKey: string): Promise<MiningRequestStatus | null> {
  if (!isRedisEnabled()) {
    return null
  }

  const redis = getRedisClient()
  const raw = await redis.get(getStatusKey(idempotencyKey))
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as MiningRequestStatus
  } catch (error) {
    console.warn(`[mining] Failed to parse status for ${idempotencyKey}`, error)
    return null
  }
}

async function writeStatus(status: MiningRequestStatus, ttlMs?: number): Promise<void> {
  if (!isRedisEnabled()) {
    return
  }

  const redis = getRedisClient()
  const key = getStatusKey(status.idempotencyKey)
  const expiration = Math.max(1000, ttlMs ?? MINING_STATUS_TTL_MS)
  await redis.set(key, JSON.stringify(status), "PX", expiration)
}

export interface EnqueueMiningRequestInput {
  userId: string
  idempotencyKey: string
  sourceIp?: string | null
  userAgent?: string | null
}

export interface EnqueueMiningRequestResult {
  status: MiningRequestStatus
  enqueued: boolean
  duplicate: boolean
}

const MAX_QUEUE_DEPTH = Number(process.env.MINING_QUEUE_MAX_DEPTH ?? 5000)

export async function enqueueMiningRequest(
  payload: EnqueueMiningRequestInput,
): Promise<EnqueueMiningRequestResult> {
  if (!isRedisEnabled() || !isMiningQueueEnabled()) {
    throw new Error("Mining queue is disabled. Ensure REDIS_URL is configured.")
  }

  const redis = getRedisClient()
  const existing = await getMiningRequestStatus(payload.idempotencyKey)
  if (existing) {
    return { status: existing, enqueued: false, duplicate: true }
  }

  const queueDepth = await getMiningQueueDepth()
  if (queueDepth >= MAX_QUEUE_DEPTH) {
    const status: MiningRequestStatus = {
      status: "failed",
      idempotencyKey: payload.idempotencyKey,
      userId: payload.userId,
      requestedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sourceIp: payload.sourceIp,
      userAgent: payload.userAgent,
      queueDepth,
      error: {
        message: "System is throttling mining clicks due to load",
        retryable: true,
        retryAfterMs: 1000,
        code: "QUEUE_BACKPRESSURE",
      },
    }

    await writeStatus(status, MINING_FAILURE_TTL_MS)
    return { status, enqueued: false, duplicate: false }
  }

  const now = new Date().toISOString()
  const status: MiningRequestStatus = {
    status: "queued",
    idempotencyKey: payload.idempotencyKey,
    userId: payload.userId,
    requestedAt: now,
    updatedAt: now,
    sourceIp: payload.sourceIp,
    userAgent: payload.userAgent,
    queueDepth,
  }

  const key = getStatusKey(payload.idempotencyKey)
  const setResult = await redis.set(key, JSON.stringify(status), "PX", MINING_STATUS_TTL_MS, "NX")
  if (setResult !== "OK") {
    const fresh = await getMiningRequestStatus(payload.idempotencyKey)
    if (fresh) {
      return { status: fresh, enqueued: false, duplicate: true }
    }

    throw new Error("Unable to reserve mining idempotency key")
  }

  const jobPayload: MiningClickJobData = {
    userId: payload.userId,
    idempotencyKey: payload.idempotencyKey,
    requestedAt: now,
    sourceIp: payload.sourceIp,
    userAgent: payload.userAgent,
  }

  await enqueueMiningClickJob(jobPayload, {
    removeOnComplete: { count: 2000, age: 3600 },
    removeOnFail: { count: 2000, age: 86400 },
  })

  return { status, enqueued: true, duplicate: false }
}

export async function markMiningStatus(
  idempotencyKey: string,
  updater: (previous: MiningRequestStatus | null) => MiningRequestStatus,
  ttlMs?: number,
): Promise<MiningRequestStatus> {
  if (!isRedisEnabled()) {
    throw new Error("Redis is required to update mining status")
  }

  const redis = getRedisClient()
  const key = getStatusKey(idempotencyKey)

  const previous = await getMiningRequestStatus(idempotencyKey)
  const next = updater(previous)
  next.updatedAt = new Date().toISOString()
  await writeStatus(next, ttlMs)
  return next
}

export async function markMiningStatusProcessing(idempotencyKey: string): Promise<MiningRequestStatus> {
  return markMiningStatus(
    idempotencyKey,
    (prev) => ({
      ...(prev ?? {
        status: "queued",
        idempotencyKey,
        userId: "unknown",
        requestedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      status: "processing",
    }),
  )
}

export async function markMiningStatusCompleted(
  idempotencyKey: string,
  userId: string,
  result: Record<string, unknown>,
): Promise<MiningRequestStatus> {
  return markMiningStatus(
    idempotencyKey,
    (prev) => ({
      ...(prev ?? {
        status: "queued",
        idempotencyKey,
        userId,
        requestedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      status: "completed",
      userId,
      result,
    }),
  )
}

export { isMiningQueueEnabled } from "@/lib/queues/mining-clicks"

export async function markMiningStatusFailed(
  idempotencyKey: string,
  userId: string,
  error: MiningRequestStatus["error"],
  ttlMs = MINING_FAILURE_TTL_MS,
): Promise<MiningRequestStatus> {
  return markMiningStatus(
    idempotencyKey,
    (prev) => ({
      ...(prev ?? {
        status: "queued",
        idempotencyKey,
        userId,
        requestedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      status: "failed",
      userId,
      error,
    }),
    ttlMs,
  )
}
