import { Queue, Worker, type JobsOptions } from "bullmq"

const connection = process.env.REDIS_URL
  ? { connection: { url: process.env.REDIS_URL } }
  : undefined

export const reportQueue = new Queue("reports", connection)

export function enqueueReport<T>(name: string, data: T, options?: JobsOptions) {
  return reportQueue.add(name, data, options)
}

export function createReportWorker(handler: Parameters<typeof Worker>[1]) {
  if (!process.env.REDIS_URL) {
    console.warn("[queue] REDIS_URL not set. Workers are disabled.")
    return null
  }

  return new Worker("reports", handler, connection)
}
