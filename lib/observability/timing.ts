import { logError, logInfo, logWarn } from "@/lib/logger"

export interface TimingOptions {
  /** Treat requests taking longer than this as slow. */
  slowThresholdMs?: number
  /**
   * Optional timeout for the wrapped handler. If exceeded, a TimeoutError is thrown
   * to prevent the request from hanging indefinitely.
   */
  timeoutMs?: number
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TimeoutError"
  }
}

export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError || (typeof error === "object" && error !== null && (error as any).name === "TimeoutError")
}

const DEFAULT_SLOW_THRESHOLD_MS = Number(process.env.SLOW_REQUEST_THRESHOLD_MS ?? 1500)
const DEFAULT_TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS ?? 8000)

export async function withRequestTiming<T>(
  scope: string,
  handler: () => Promise<T>,
  options: TimingOptions = {},
): Promise<T> {
  const start = Date.now()
  const slowThresholdMs = options.slowThresholdMs ?? DEFAULT_SLOW_THRESHOLD_MS
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  let timeoutId: NodeJS.Timeout | null = null
  const timeoutPromise = new Promise<never>((_, reject) => {
    if (!timeoutMs || timeoutMs <= 0) return
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(`${scope} exceeded ${timeoutMs}ms`))
    }, timeoutMs)
  })

  try {
    const result = await (timeoutMs > 0 ? Promise.race([handler(), timeoutPromise]) : handler())
    return result as T
  } catch (error) {
    logError(scope, "Request failed", { error })
    throw error
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    const duration = Date.now() - start
    if (duration > slowThresholdMs) {
      logWarn(scope, "Slow request detected", { durationMs: duration })
    } else {
      logInfo(scope, "Request completed", { durationMs: duration })
    }
  }
}
