export type LogLevel = "info" | "warn" | "error"

interface LogDetails {
  error?: unknown
  [key: string]: unknown
}

interface SerializedError {
  name: string
  message: string
  stack?: string
  cause?: unknown
}

function serializeError(input: unknown): SerializedError | undefined {
  if (!input) return undefined

  if (input instanceof Error) {
    return {
      name: input.name || "Error",
      message: input.message,
      stack: input.stack,
      cause: "cause" in input ? (input as Error & { cause?: unknown }).cause : undefined,
    }
  }

  if (typeof input === "object") {
    try {
      return {
        name: input?.constructor?.name ?? "Error",
        message: JSON.stringify(input),
      }
    } catch {
      return {
        name: "Error",
        message: String(input),
      }
    }
  }

  return {
    name: "Error",
    message: String(input),
  }
}

function resolveConsole(level: LogLevel) {
  switch (level) {
    case "error":
      return console.error
    case "warn":
      return console.warn
    default:
      return console.info
  }
}

function emitLog(level: LogLevel, scope: string, message: string, details?: LogDetails) {
  const timestamp = new Date().toISOString()
  const base = `[${timestamp}] [${scope}] ${message}`

  if (!details || Object.keys(details).length === 0) {
    resolveConsole(level)(base)
    return
  }

  const payload: Record<string, unknown> = { ...details }
  if (details.error) {
    payload.error = serializeError(details.error)
  }

  resolveConsole(level)(base, payload)
}

export function logInfo(scope: string, message: string, details?: LogDetails) {
  emitLog("info", scope, message, details)
}

export function logWarn(scope: string, message: string, details?: LogDetails) {
  emitLog("warn", scope, message, details)
}

export function logError(scope: string, message: string, details?: LogDetails) {
  emitLog("error", scope, message, details)
}

export function logClientError(scope: string, message: string, details?: LogDetails) {
  emitLog("error", scope, message, details)
}
