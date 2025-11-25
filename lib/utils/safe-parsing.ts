export function ensureNumber(value: unknown, fallback = 0): number {
  const numberValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN

  return Number.isFinite(numberValue) ? numberValue : fallback
}

export function ensureDate(value: unknown): Date | null {
  if (value === null || value === undefined) {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const date = new Date(value as string)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatNumberWithFallback(value: unknown, fallback = "0"): string {
  const numberValue = ensureNumber(value, Number.NaN)
  if (!Number.isFinite(numberValue)) {
    return fallback
  }

  return numberValue.toLocaleString()
}
