const DECIMAL_PATTERN = /^[-+]?\d*(?:\.\d+)?$/

function normaliseDecimalString(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  if (trimmed === "." || trimmed === "-" || trimmed === "+") {
    return null
  }

  if (!DECIMAL_PATTERN.test(trimmed)) {
    return null
  }

  return trimmed
}

export function toScaledInteger(value: unknown, scale: number): number | null {
  if (typeof scale !== "number" || !Number.isInteger(scale) || scale < 0) {
    throw new TypeError("scale must be a non-negative integer")
  }

  if (value === null || value === undefined) {
    return null
  }

  let decimalString: string | null = null

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null
    }
    decimalString = normaliseDecimalString(value.toString())
  } else if (typeof value === "string") {
    decimalString = normaliseDecimalString(value)
  } else if (typeof (value as { toString?: () => string }).toString === "function") {
    decimalString = normaliseDecimalString((value as { toString: () => string }).toString())
  }

  if (!decimalString) {
    return null
  }

  const isNegative = decimalString.startsWith("-")
  const unsigned = decimalString.replace(/^[-+]/, "")
  const [integerPartRaw = "0", fractionalPartRaw = ""] = unsigned.split(".")

  const integerPart = integerPartRaw === "" ? "0" : integerPartRaw
  const paddedFraction = (fractionalPartRaw + "0".repeat(scale + 1)).slice(0, scale + 1)

  const mainFraction = paddedFraction.slice(0, scale)
  const roundingDigit = paddedFraction[scale] ?? "0"

  const integerValue = Number.parseInt(integerPart, 10) || 0
  const fractionValue = Number.parseInt(mainFraction || "0", 10) || 0
  const power = 10 ** scale

  let scaledValue = integerValue * power + fractionValue

  if (roundingDigit >= "5") {
    scaledValue += 1
  }

  if (isNegative) {
    scaledValue *= -1
  }

  if (!Number.isFinite(scaledValue)) {
    throw new RangeError("Scaled integer is outside the supported number range")
  }

  return scaledValue
}

function divideAndRound(value: number, divisor: number): number {
  if (divisor === 0) {
    throw new RangeError("Cannot divide by zero")
  }

  return Math.round(value / divisor)
}

export function multiplyAmountByPercent(amount: unknown, percent: unknown): number {
  const cents = toScaledInteger(amount, 2)
  const basisPoints = toScaledInteger(percent, 2)

  if (cents === null || basisPoints === null) {
    return 0
  }

  const resultCents = divideAndRound(cents * basisPoints, 10_000)
  const result = resultCents / 100

  return Number.isFinite(result) ? Number(result.toFixed(2)) : 0
}

export function calculatePercentFromAmounts(part: unknown, total: unknown): number {
  const partMinor = toScaledInteger(part, 2)
  const totalMinor = toScaledInteger(total, 2)

  if (partMinor === null || totalMinor === null || totalMinor === 0) {
    return 0
  }

  const basisPoints = divideAndRound(partMinor * 10_000, totalMinor)
  const percent = basisPoints / 100

  return Number.isFinite(percent) ? Number(percent.toFixed(2)) : 0
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function fromScaledInteger(value: number, scale: number): number {
  const factor = 10 ** scale
  return Number.isFinite(value) ? Number((value / factor).toFixed(scale)) : 0
}
