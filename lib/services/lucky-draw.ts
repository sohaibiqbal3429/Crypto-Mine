import { randomInt } from "crypto"

import type { HydratedDocument } from "mongoose"

import dbConnect from "@/lib/mongodb"
import Balance from "@/models/Balance"
import LuckyDrawEntry, { type ILuckyDrawEntry } from "@/models/LuckyDrawEntry"
import LuckyDrawRound, { type ILuckyDrawRound } from "@/models/LuckyDrawRound"
import Settings from "@/models/Settings"
import Transaction from "@/models/Transaction"
import User from "@/models/User"

const DEFAULT_ENTRY_FEE = 10
const DEFAULT_PRIZE = 30
const DEFAULT_CYCLE_HOURS = 72

export type LuckyDrawStatus = "open" | "closed" | "completed"

export interface LuckyDrawConfig {
  entryFee: number
  prize: number
  cycleHours: number
  autoDrawEnabled: boolean
}

type LuckyDrawRoundDoc = HydratedDocument<ILuckyDrawRound>
type LuckyDrawEntryDoc = HydratedDocument<ILuckyDrawEntry>

export interface LuckyDrawCurrentRoundSummary {
  round: LuckyDrawRoundDoc | null
  config: LuckyDrawConfig
  hasJoined: boolean
  entries: number
  nextDrawAt: Date | null
  previousRound: LuckyDrawRoundDoc | null
}

export interface LuckyDrawAdminRoundSummary {
  round: LuckyDrawRoundDoc | null
  participants: Array<
    LuckyDrawEntryDoc & {
      user?: { _id: string; name: string; email: string; referralCode: string }
    }
  >
  config: LuckyDrawConfig
}

export class LuckyDrawServiceError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

async function ensureSettings(): Promise<{ config: LuckyDrawConfig; settingsId: string }> {
  await dbConnect()
  let settings = await Settings.findOne()
  if (!settings) {
    settings = await Settings.create({ luckyDraw: defaultConfig() })
  }

  const config = normalizeConfig(settings.luckyDraw)
  if (!settings.luckyDraw || hasConfigChanged(settings.luckyDraw, config)) {
    await Settings.updateOne(
      { _id: settings._id },
      {
        $set: {
          luckyDraw: config,
        },
      },
    )
  }

  return { config, settingsId: String(settings._id) }
}

function hasConfigChanged(existing: any, config: LuckyDrawConfig) {
  if (!existing) return true
  return (
    existing.entryFee !== config.entryFee ||
    existing.prize !== config.prize ||
    existing.cycleHours !== config.cycleHours ||
    existing.autoDrawEnabled !== config.autoDrawEnabled
  )
}

function defaultConfig(): LuckyDrawConfig {
  return {
    entryFee: DEFAULT_ENTRY_FEE,
    prize: DEFAULT_PRIZE,
    cycleHours: DEFAULT_CYCLE_HOURS,
    autoDrawEnabled: true,
  }
}

function normalizeConfig(raw: any): LuckyDrawConfig {
  const defaults = defaultConfig()
  if (!raw) return defaults

  const entryFee = Number(raw.entryFee)
  const prize = Number(raw.prize)
  const cycleHours = Number(raw.cycleHours)

  return {
    entryFee: Number.isFinite(entryFee) && entryFee > 0 ? entryFee : defaults.entryFee,
    prize: Number.isFinite(prize) && prize > 0 ? prize : defaults.prize,
    cycleHours: Number.isFinite(cycleHours) && cycleHours > 0 ? cycleHours : defaults.cycleHours,
    autoDrawEnabled: typeof raw.autoDrawEnabled === "boolean" ? raw.autoDrawEnabled : defaults.autoDrawEnabled,
  }
}

export async function getLuckyDrawConfig(): Promise<LuckyDrawConfig> {
  const { config } = await ensureSettings()
  return config
}

async function loadLatestCompletedRound(): Promise<LuckyDrawRoundDoc | null> {
  const [round] = await LuckyDrawRound.find({ status: "completed" })
    .sort({ completedAt: -1 })
    .limit(1)

  return round ?? null
}

async function findOpenRound(): Promise<LuckyDrawRoundDoc | null> {
  const [round] = await LuckyDrawRound.find({ status: "open" })
    .sort({ startsAt: -1 })
    .limit(1)

  return round ?? null
}

async function findClosedRound(): Promise<LuckyDrawRoundDoc | null> {
  const [round] = await LuckyDrawRound.find({ status: "closed" })
    .sort({ endsAt: 1 })
    .limit(1)

  return round ?? null
}

export async function ensureCurrentLuckyDrawRound(): Promise<{
  round: LuckyDrawRoundDoc | null
  config: LuckyDrawConfig
}> {
  const { config } = await ensureSettings()
  const now = new Date()

  let openRound = await findOpenRound()

  if (openRound && openRound.endsAt <= now) {
    if (config.autoDrawEnabled) {
      await finalizeLuckyDrawRound(openRound.id, { trigger: "auto" })
      openRound = null
    } else {
      await LuckyDrawRound.findByIdAndUpdate(openRound._id, { status: "closed", closedAt: now })
      openRound = null
    }
  }

  if (!openRound) {
    const pendingClosed = await findClosedRound()
    if (!pendingClosed) {
      const startsAt = now
      const endsAt = new Date(startsAt.getTime() + config.cycleHours * 60 * 60 * 1000)
      const created = await LuckyDrawRound.create({
        status: "open",
        startsAt,
        endsAt,
        entryFee: config.entryFee,
        prize: config.prize,
        totalEntries: 0,
      })
      openRound = await LuckyDrawRound.findById(created._id)
    }
  } else if (openRound && (openRound.entryFee !== config.entryFee || openRound.prize !== config.prize)) {
    await LuckyDrawRound.findByIdAndUpdate(openRound._id, {
      entryFee: config.entryFee,
      prize: config.prize,
    })
    openRound = await LuckyDrawRound.findById(openRound._id)
  }

  return { round: openRound, config }
}

export async function getCurrentRoundSummaryForUser(userId: string): Promise<LuckyDrawCurrentRoundSummary> {
  const { round, config } = await ensureCurrentLuckyDrawRound()
  const previousRound = await loadLatestCompletedRound()

  if (!round) {
    return {
      round: null,
      config,
      hasJoined: false,
      entries: 0,
      nextDrawAt: null,
      previousRound,
    }
  }

  const [entry, totalEntries] = await Promise.all([
    LuckyDrawEntry.findOne({ roundId: round._id, userId }),
    LuckyDrawEntry.countDocuments({ roundId: round._id }),
  ])

  if (round.totalEntries !== totalEntries) {
    await LuckyDrawRound.updateOne({ _id: round._id }, { totalEntries })
    round.totalEntries = totalEntries
  }

  return {
    round,
    config,
    hasJoined: Boolean(entry),
    entries: totalEntries,
    nextDrawAt: round.endsAt,
    previousRound,
  }
}

export async function joinLuckyDrawRound(userId: string, roundId: string) {
  const { config } = await ensureSettings()
  await dbConnect()

  const round = await LuckyDrawRound.findById(roundId)
  if (!round) {
    throw new LuckyDrawServiceError("Round not found", 404)
  }

  if (round.status !== "open") {
    throw new LuckyDrawServiceError("This round is not accepting new entries", 400)
  }

  if (round.endsAt <= new Date()) {
    throw new LuckyDrawServiceError("This round has already closed", 400)
  }

  const existingEntry = await LuckyDrawEntry.findOne({ roundId: round._id, userId })
  if (existingEntry) {
    throw new LuckyDrawServiceError("You have already joined this round", 400)
  }

  const balanceUpdate = await Balance.updateOne(
    { userId, current: { $gte: config.entryFee } },
    {
      $inc: { current: -config.entryFee, totalBalance: -config.entryFee },
    },
  )

  if (balanceUpdate.modifiedCount === 0) {
    throw new LuckyDrawServiceError("Insufficient balance", 402)
  }

  await LuckyDrawEntry.create({ roundId: round._id, userId })
  await LuckyDrawRound.updateOne({ _id: round._id }, { $inc: { totalEntries: 1 } })

  await Transaction.create({
    userId,
    type: "luckyDrawEntry",
    amount: config.entryFee,
    status: "approved",
    meta: { roundId: String(round._id) },
  })
}

export async function finalizeLuckyDrawRound(
  roundId: string,
  options: { trigger?: "auto" | "manual"; startNextRound?: boolean } = {},
) {
  const { config } = await ensureSettings()
  const round = await LuckyDrawRound.findById(roundId)
  if (!round) {
    throw new LuckyDrawServiceError("Round not found", 404)
  }

  if (round.status === "completed") {
    return round
  }

  const entries = await LuckyDrawEntry.find({ roundId: round._id })
  let winnerEntry: LuckyDrawEntryDoc | undefined

  if (entries.length > 0) {
    const index = entries.length === 1 ? 0 : randomInt(entries.length)
    winnerEntry = entries[index]
  }

  let payoutTxId: string | null = null
  let winnerSnapshot: ILuckyDrawRound["winnerSnapshot"] | null = null

  if (winnerEntry) {
    const userId = winnerEntry.userId
    await Balance.updateOne(
      { userId },
      {
        $inc: { current: round.prize, totalBalance: round.prize, totalEarning: round.prize },
      },
    )

    const payoutTx = await Transaction.create({
      userId,
      type: "luckyDrawReward",
      amount: round.prize,
      status: "approved",
      meta: { roundId: String(round._id), trigger: options.trigger ?? "auto" },
    })

    payoutTxId = String(payoutTx._id)

    const winnerUser = await User.findById(userId)
    if (winnerUser) {
      winnerSnapshot = {
        userId: winnerUser._id as any,
        name: winnerUser.name ?? "",
        referralCode: winnerUser.referralCode ?? "",
        email: winnerUser.email ?? "",
        creditedAt: new Date(),
      }
    }
  }

  await LuckyDrawRound.findByIdAndUpdate(round._id, {
    status: "completed",
    winnerUserId: winnerEntry?.userId ?? null,
    payoutTxId,
    winnerSnapshot,
    completedAt: new Date(),
    closedAt: new Date(),
  })

  const completedRound = await LuckyDrawRound.findById(round._id)

  if (options.startNextRound !== false) {
    await ensureCurrentLuckyDrawRound()
  }

  return completedRound
}

export async function listLuckyDrawRounds(status?: LuckyDrawStatus, limit = 20) {
  await ensureSettings()
  const query: Record<string, any> = {}
  if (status) {
    query.status = status
  }

  const rounds = await LuckyDrawRound.find(query).sort({ startsAt: -1 }).limit(limit)
  return rounds
}

export async function getRoundParticipants(roundId: string) {
  await ensureSettings()

  const entries = await LuckyDrawEntry.find({ roundId })
    .sort({ joinedAt: -1 })
    .populate("userId", "name email referralCode")

  return entries.map((entry) => ({
    _id: ((entry as any)._id ?? "").toString(),
    user:
      entry.userId && typeof (entry.userId as any) === "object" && "_id" in (entry.userId as any)
        ? {
            _id: ((entry.userId as any)._id ?? "").toString(),
            name: ((entry.userId as any).name ?? "") as string,
            email: ((entry.userId as any).email ?? "") as string,
            referralCode: ((entry.userId as any).referralCode ?? "") as string,
          }
        : undefined,
    joinedAt: entry.joinedAt?.toISOString?.() ?? new Date(entry.joinedAt).toISOString(),
  }))
}

export async function updateLuckyDrawSettings(update: Partial<LuckyDrawConfig>) {
  const { settingsId, config } = await ensureSettings()

  const nextConfig: LuckyDrawConfig = {
    entryFee: update.entryFee && update.entryFee > 0 ? update.entryFee : config.entryFee,
    prize: update.prize && update.prize > 0 ? update.prize : config.prize,
    cycleHours: update.cycleHours && update.cycleHours > 0 ? update.cycleHours : config.cycleHours,
    autoDrawEnabled:
      typeof update.autoDrawEnabled === "boolean" ? update.autoDrawEnabled : config.autoDrawEnabled,
  }

  await Settings.updateOne({ _id: settingsId }, { $set: { luckyDraw: nextConfig } })

  return nextConfig
}

export async function refundLuckyDrawEntry(roundId: string, entryId: string) {
  await ensureSettings()

  const entry = await LuckyDrawEntry.findOne({ _id: entryId, roundId })
  if (!entry) {
    throw new LuckyDrawServiceError("Entry not found", 404)
  }

  const round = await LuckyDrawRound.findById(roundId)
  if (!round) {
    throw new LuckyDrawServiceError("Round not found", 404)
  }

  if (round.status === "completed" && entry.userId?.toString() === round.winnerUserId?.toString()) {
    throw new LuckyDrawServiceError("Cannot refund the winning entry", 400)
  }

  await LuckyDrawEntry.deleteOne({ _id: entryId })
  await LuckyDrawRound.updateOne({ _id: roundId }, { $inc: { totalEntries: -1 } })

  await Balance.updateOne(
    { userId: entry.userId },
    {
      $inc: { current: round.entryFee, totalBalance: round.entryFee },
    },
  )

  await Transaction.create({
    userId: entry.userId,
    type: "luckyDrawReward",
    amount: round.entryFee,
    status: "approved",
    meta: { roundId: String(round._id), refund: true },
  })
}
