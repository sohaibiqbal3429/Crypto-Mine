export function isTransactionNotSupportedError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false
  }

  const candidate = error as { code?: unknown; message?: unknown }
  if (candidate.code === 20) {
    return true
  }

  const message = typeof candidate.message === "string" ? candidate.message : ""
  return message.includes("Transaction numbers are only allowed on a replica set member or mongos")
}
