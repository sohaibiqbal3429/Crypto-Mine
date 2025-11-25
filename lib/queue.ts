import { Queue, Worker, type Job, type JobsOptions } from "bullmq"

const hasRedis = Boolean(process.env.REDIS_URL)
const queueOptions = hasRedis ? { connection: { url: process.env.REDIS_URL! } } : undefined

const reportQueueInstance = hasRedis ? new Queue("reports", queueOptions) : null

export function isReportQueueEnabled(): boolean {
  return reportQueueInstance !== null
}

export function enqueueReport<T>(name: string, data: T, options?: JobsOptions): Promise<Job<T>> | null {
  if (!reportQueueInstance) {
    console.warn(`[queue] Skipping job "${name}" because REDIS_URL is not configured.`)
    return null
  }

  return reportQueueInstance.add(name, data, options)
}

export function createReportWorker(handler: Parameters<typeof Worker>[1]) {
  if (!hasRedis) {
    console.warn("[queue] REDIS_URL not set. Workers are disabled.")
    return null
  }

  return new Worker("reports", handler, queueOptions)
}

export const reportQueue = reportQueueInstance
