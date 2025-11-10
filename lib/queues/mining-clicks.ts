import { Queue, Worker, QueueEvents, type Job, type JobsOptions, type Processor } from "bullmq"

import { isRedisEnabled } from "@/lib/redis"

export interface MiningClickJobData {
  userId: string
  idempotencyKey: string
  requestedAt: string
  sourceIp?: string | null
  userAgent?: string | null
}

const queueName = "mining-clicks"

const hasRedis = isRedisEnabled()

const queueOptions = hasRedis
  ? {
      connection: { url: process.env.REDIS_URL!, maxRetriesPerRequest: null },
      defaultJobOptions: {
        removeOnComplete: { count: 1000, age: 3600 },
        removeOnFail: { count: 2000, age: 86400 },
        attempts: 3,
        backoff: {
          type: "exponential" as const,
          delay: 2000,
        },
      } satisfies JobsOptions,
    }
  : undefined

const miningQueueInstance = hasRedis ? new Queue<MiningClickJobData>(queueName, queueOptions) : null
const miningQueueEventsInstance = hasRedis ? new QueueEvents(queueName, queueOptions) : null
const defaultConcurrency = Number(process.env.MINING_WORKER_CONCURRENCY ?? 4)

export function isMiningQueueEnabled(): boolean {
  return miningQueueInstance !== null
}

export async function enqueueMiningClickJob(
  data: MiningClickJobData,
  options?: JobsOptions,
): Promise<Job<MiningClickJobData>> {
  if (!miningQueueInstance) {
    throw new Error("Mining queue is disabled because REDIS_URL is not configured")
  }

  return miningQueueInstance.add(data.idempotencyKey, data, {
    jobId: data.idempotencyKey,
    ...options,
  })
}

export async function getMiningQueueDepth(): Promise<number> {
  if (!miningQueueInstance) {
    return 0
  }

  const [waiting, paused, delayed] = await Promise.all([
    miningQueueInstance.getWaitingCount(),
    miningQueueInstance.getPausedCount(),
    miningQueueInstance.getDelayedCount(),
  ])

  return waiting + paused + delayed
}

export function createMiningClickWorker(
  processor: Processor<MiningClickJobData>,
  options?: { concurrency?: number },
): Worker<MiningClickJobData> | null {
  if (!hasRedis) {
    console.warn("[queue] Mining queue worker disabled. Configure REDIS_URL to enable processing.")
    return null
  }

  return new Worker(queueName, processor, {
    ...queueOptions,
    concurrency: options?.concurrency ?? defaultConcurrency,
  })
}

export function getMiningQueueEvents(): QueueEvents | null {
  return miningQueueEventsInstance
}
