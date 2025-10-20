import dbConnect from "@/lib/mongodb"
import Settings, { type ISettings } from "@/models/Settings"

import { clampNumber, fromScaledInteger, toScaledInteger } from "@/lib/utils/numeric"

const DEFAULT_DAILY_PROFIT_PERCENT = 1.5

function parseBound(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback
  }

  const numeric = Number.parseFloat(value)
  if (!Number.isFinite(numeric)) {
    return fallback
  }

  return numeric
}

const DAILY_PROFIT_PERCENT_MIN = parseBound(process.env.DAILY_PROFIT_PERCENT_MIN, 0)
const DAILY_PROFIT_PERCENT_MAX = parseBound(process.env.DAILY_PROFIT_PERCENT_MAX, 10)

export class DailyProfitPercentValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DailyProfitPercentValidationError"
  }
}

function extractPercentValue(source: unknown): number | null {
  const scaled = toScaledInteger(source, 2)
  if (scaled === null) {
    return null
  }

  return fromScaledInteger(scaled, 2)
}

export function getDailyProfitPercentBounds(): { min: number; max: number } {
  const min = Number.isFinite(DAILY_PROFIT_PERCENT_MIN) ? DAILY_PROFIT_PERCENT_MIN : 0
  const max = Number.isFinite(DAILY_PROFIT_PERCENT_MAX) ? DAILY_PROFIT_PERCENT_MAX : 10

  if (min >= max) {
    return { min: 0, max: 10 }
  }

  return { min, max }
}

export function resolveDailyProfitPercent(settings?: Partial<ISettings> | null): number {
  const bounds = getDailyProfitPercentBounds()

  const candidates: Array<number | null> = [
    extractPercentValue(settings?.dailyProfitPercent ?? null),
    extractPercentValue(settings?.mining?.minPct),
    extractPercentValue(settings?.mining?.maxPct),
  ]

  const resolved = candidates.find((value): value is number => typeof value === "number" && Number.isFinite(value))

  const value = typeof resolved === "number" ? resolved : DEFAULT_DAILY_PROFIT_PERCENT
  return clampNumber(Number(value.toFixed(2)), bounds.min, bounds.max)
}

export async function getDailyProfitPercent(): Promise<number> {
  await dbConnect()

  const settingsDoc = await Settings.findOne()
  const plainSettings = settingsDoc
    ? ((typeof settingsDoc.toObject === "function" ? settingsDoc.toObject() : settingsDoc) as Partial<ISettings>)
    : null

  return resolveDailyProfitPercent(plainSettings)
}

export async function updateDailyProfitPercent(nextPercent: unknown): Promise<number> {
  const bounds = getDailyProfitPercentBounds()
  const scaled = toScaledInteger(nextPercent, 2)

  if (scaled === null) {
    throw new DailyProfitPercentValidationError("Enter a valid percentage with up to two decimals.")
  }

  const resolvedPercent = fromScaledInteger(scaled, 2)

  if (resolvedPercent < bounds.min || resolvedPercent > bounds.max) {
    throw new DailyProfitPercentValidationError(
      `Daily profit percent must be between ${bounds.min.toFixed(2)}% and ${bounds.max.toFixed(2)}%.`,
    )
  }

  const percentString = resolvedPercent.toFixed(2)

  await dbConnect()

  await Settings.findOneAndUpdate(
    {},
    {
      $set: {
        dailyProfitPercent: percentString,
        "mining.minPct": resolvedPercent,
        "mining.maxPct": resolvedPercent,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  )

  return resolvedPercent
}
