import dbConnect from "@/lib/mongodb"
import Settings, { type ISettings } from "@/models/Settings"

import { clampNumber, fromScaledInteger, toScaledInteger } from "@/lib/utils/numeric"

const DEFAULT_DAILY_PROFIT_PERCENT = 1.5
const DEFAULT_TEAM_DAILY_PROFIT_PERCENT: number | null = null

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
const TEAM_DAILY_PROFIT_PERCENT_MIN = parseBound(process.env.TEAM_DAILY_PROFIT_PERCENT_MIN, 0)
const TEAM_DAILY_PROFIT_PERCENT_MAX = parseBound(process.env.TEAM_DAILY_PROFIT_PERCENT_MAX, 10)

export class DailyProfitPercentValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DailyProfitPercentValidationError"
  }
}

export class TeamDailyProfitPercentValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TeamDailyProfitPercentValidationError"
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

export function getTeamDailyProfitPercentBounds(): { min: number; max: number } {
  const min = Number.isFinite(TEAM_DAILY_PROFIT_PERCENT_MIN) ? TEAM_DAILY_PROFIT_PERCENT_MIN : 0
  const max = Number.isFinite(TEAM_DAILY_PROFIT_PERCENT_MAX) ? TEAM_DAILY_PROFIT_PERCENT_MAX : 10

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

function resolveTeamDailyProfitPercent(settings?: Partial<ISettings> | null): number | null {
  const value = extractPercentValue(settings?.teamDailyProfitPercent ?? null)
  if (typeof value === "number" && Number.isFinite(value)) {
    const bounds = getTeamDailyProfitPercentBounds()
    return clampNumber(Number(value.toFixed(2)), bounds.min, bounds.max)
  }
  return DEFAULT_TEAM_DAILY_PROFIT_PERCENT
}

export async function getTeamDailyProfitPercent(): Promise<number | null> {
  await dbConnect()
  const settingsDoc = await Settings.findOne()
  const plainSettings = settingsDoc
    ? ((typeof settingsDoc.toObject === "function" ? settingsDoc.toObject() : settingsDoc) as Partial<ISettings>)
    : null
  return resolveTeamDailyProfitPercent(plainSettings)
}

export async function updateTeamDailyProfitPercent(nextPercent: unknown): Promise<number | null> {
  const bounds = getTeamDailyProfitPercentBounds()

  if (nextPercent === null || nextPercent === undefined || nextPercent === "") {
    await dbConnect()
    await Settings.findOneAndUpdate(
      {},
      { $unset: { teamDailyProfitPercent: "" } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    )
    return null
  }

  const scaled = toScaledInteger(nextPercent, 2)
  if (scaled === null) {
    throw new TeamDailyProfitPercentValidationError(
      "Enter a valid percentage with up to two decimals.",
    )
  }

  const resolvedPercent = fromScaledInteger(scaled, 2)
  if (resolvedPercent < bounds.min || resolvedPercent > bounds.max) {
    throw new TeamDailyProfitPercentValidationError(
      `Team daily profit percent must be between ${bounds.min.toFixed(2)}% and ${bounds.max.toFixed(2)}%.`,
    )
  }

  const percentString = resolvedPercent.toFixed(2)

  await dbConnect()
  await Settings.findOneAndUpdate(
    {},
    {
      $set: {
        teamDailyProfitPercent: percentString,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  )

  return resolvedPercent
}
