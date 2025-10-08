import crypto from "crypto"
import { randomInt } from "crypto"

import dbConnect from "@/lib/mongodb"
import Balance from "@/models/Balance"
import BlindBoxParticipant from "@/models/BlindBoxParticipant"
import BlindBoxDeposit from "@/models/BlindBoxDeposit"
import BlindBoxRound from "@/models/BlindBoxRound"
import Notification from "@/models/Notification"
import Settings from "@/models/Settings"
import Transaction from "@/models/Transaction"
import User from "@/models/User"

const DEFAULT_DEPOSIT_AMOUNT = 10
const DEFAULT_REWARD_AMOUNT = 30
const DEFAULT_CYCLE_HOURS = 72

export type BlindBoxRoundStatus = "open" | "completed"

export interface BlindBoxConfig {
  depositAmount: number
  rewardAmount: number
  cycleHours: number
  autoDrawEnabled: boolean
}

export interface BlindBoxSummaryRoundPayload {
  id: string
  status: BlindBoxRoundStatus
  startTime: string
  endTime: string
  totalParticipants: number
  rewardAmount: number
  depositAmount: number
  winnerSnapshot: {
    name: string
    referralCode?: string | null
    email?: string | null
    creditedAt?: string | null
  } | null
  winnerUserId: string | null
}

export interface BlindBoxSummaryResponse {
  round: BlindBoxSummaryRoundPayload | null
  previousRound: BlindBoxSummaryRoundPayload | null
  nextDrawAt: string | null
  participants: number
  config: BlindBoxConfig
  userStatus: {
    isParticipant: boolean
    joinedAt: string | null
    lastEntryTransactionId: string | null
  }
}

export interface BlindBoxDepositDetails {
  txId: string
  network?: string | null
  address?: string | null
}

export class BlindBoxServiceError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

async function ensureSettings(): Promise<{ config: BlindBoxConfig; settingsId: string }> {
  await dbConnect()
  let settings = await Settings.findOne()
  if (!settings) {
    settings = await Settings.create({ blindBox: defaultConfig() })
  }

  const config = normalizeConfig(settings.blindBox)
  if (!settings.blindBox || hasConfigChanged(settings.blindBox, config)) {
    await Settings.updateOne(
      { _id: settings._id },
      {
        $set: {
          blindBox: config,
        },
      },
    )
  }

  return { config, settingsId: String(settings._id) }
}

function hasConfigChanged(existing: any, config: BlindBoxConfig) {
  if (!existing) return true
  return (
    existing.depositAmount !== config.depositAmount ||
    existing.rewardAmount !== config.rewardAmount ||
    existing.cycleHours !== config.cycleHours ||
    existing.autoDrawEnabled !== config.autoDrawEnabled
  )
}

function defaultConfig(): BlindBoxConfig {
  return {
    depositAmount: DEFAULT_DEPOSIT_AMOUNT,
    rewardAmount: DEFAULT_REWARD_AMOUNT,
    cycleHours: DEFAULT_CYCLE_HOURS,
    autoDrawEnabled: true,
  }
}

function normalizeConfig(raw: any): BlindBoxConfig {
  const defaults = defaultConfig()
  if (!raw) return defaults

  const depositAmount = Number(raw.depositAmount)
  const rewardAmount = Number(raw.rewardAmount)
  const cycleHours = Number(raw.cycleHours)

  return {
    depositAmount: Number.isFinite(depositAmount) && depositAmount > 0 ? depositAmount : defaults.depositAmount,
    rewardAmount: Number.isFinite(rewardAmount) && rewardAmount > 0 ? rewardAmount : defaults.rewardAmount,
    cycleHours: Number.isFinite(cycleHours) && cycleHours > 0 ? cycleHours : defaults.cycleHours,
    autoDrawEnabled: typeof raw.autoDrawEnabled === "boolean" ? raw.autoDrawEnabled : defaults.autoDrawEnabled,
  }
}

export async function getBlindBoxConfig(): Promise<BlindBoxConfig> {
  const { config } = await ensureSettings()
  return config
}

async function loadLatestCompletedRound() {
  const [round] = await BlindBoxRound.find({ status: "completed" }).sort({ endTime: -1 }).limit(1)
  return round ?? null
}

async function findOpenRound() {
  const [round] = await BlindBoxRound.find({ status: "open" }).sort({ startTime: -1 }).limit(1)
  return round ?? null
}

async function createNewRound(config: BlindBoxConfig) {
  const now = new Date()
  const endTime = new Date(now.getTime() + config.cycleHours * 60 * 60 * 1000)
  const created = await BlindBoxRound.create({
    status: "open",
    startTime: now,
    endTime,
    depositAmount: config.depositAmount,
    rewardAmount: config.rewardAmount,
    totalParticipants: 0,
  })
  return BlindBoxRound.findById(created._id)
}

export async function ensureCurrentBlindBoxRound() {
  const { config } = await ensureSettings()
  let round = await findOpenRound()
  const now = new Date()

  if (round && round.endTime <= now && config.autoDrawEnabled) {
    await finalizeBlindBoxRound(round._id.toString(), { trigger: "auto", startNextRound: true })
    round = null
  }

  if (!round) {
    round = await createNewRound(config)
  }

  return { round, config }
}

function hashUserId(userId: string) {
  return crypto.createHash("sha256").update(userId).digest("hex")
}

export async function joinBlindBoxRound(userId: string, deposit: BlindBoxDepositDetails) {
  const { round, config } = await ensureCurrentBlindBoxRound()
  if (!round) {
    throw new BlindBoxServiceError("No active blind box round is available", 400)
  }

  if (!deposit || typeof deposit.txId !== "string" || deposit.txId.trim().length === 0) {
    throw new BlindBoxServiceError("A deposit transaction hash is required to join", 400)
  }

  await dbConnect()

  if (round.endTime <= new Date()) {
    throw new BlindBoxServiceError("The current round has already closed", 400)
  }

  const existing = await BlindBoxParticipant.findOne({ roundId: round._id, userId })
  if (existing) {
    throw new BlindBoxServiceError("You have already joined this round", 409)
  }

  const normalizedTxId = deposit.txId.trim()
  if (normalizedTxId.length < 10) {
    throw new BlindBoxServiceError("Enter a valid deposit transaction hash", 400)
  }

  const duplicateDeposit = await BlindBoxDeposit.findOne({ txId: normalizedTxId })
  if (duplicateDeposit) {
    throw new BlindBoxServiceError("This deposit transaction has already been used", 409)
  }

  const network = (deposit.network ?? "TRC20").toString().trim() || "TRC20"
  const address = (deposit.address ?? "").toString().trim() || "N/A"

  const depositRecord = await BlindBoxDeposit.create({
    userId,
    amount: config.depositAmount,
    network,
    address,
    txId: normalizedTxId,
    status: "approved",
    roundId: round._id,
    reviewedAt: new Date(),
    reviewedBy: null,
  })

  const participant = await BlindBoxParticipant.create({
    userId,
    roundId: round._id,
    depositId: depositRecord._id,
    hashedUserId: hashUserId(userId),
    status: "active",
  })

  await BlindBoxRound.updateOne({ _id: round._id }, { $inc: { totalParticipants: 1 } })

  const depositTransaction = await Transaction.create({
    userId,
    type: "blindBoxDeposit",
    amount: config.depositAmount,
    status: "approved",
    meta: {
      roundId: String(round._id),
      depositId: depositRecord._id.toString(),
      txId: normalizedTxId,
      network,
      address,
    },
  })

  const entryTransaction = await Transaction.create({
    userId,
    type: "blindBoxEntry",
    amount: config.depositAmount,
    status: "approved",
    meta: {
      roundId: String(round._id),
      depositId: depositRecord._id.toString(),
      depositTransactionId: depositTransaction._id.toString(),
    },
  })

  await Notification.create({
    userId,
    title: "Blind Box entry confirmed",
    body: `You have successfully joined the current Blind Box round for $${config.depositAmount}.`,
    kind: "blindbox-joined",
    metadata: { roundId: String(round._id) },
  })

  return { participant, transactionId: entryTransaction._id.toString(), round }
}

export async function getBlindBoxParticipants(roundId: string) {
  await ensureSettings()

  const participants = await BlindBoxParticipant.find({ roundId })
    .sort({ createdAt: -1 })
    .populate("userId", "name email referralCode")

  return participants.map((participant) => ({
    id: participant._id.toString(),
    user:
      participant.userId && typeof participant.userId === "object" && "_id" in participant.userId
        ? {
            id: (participant.userId as any)._id.toString(),
            name: (participant.userId as any).name ?? "",
            email: (participant.userId as any).email ?? "",
            referralCode: (participant.userId as any).referralCode ?? "",
          }
        : null,
    joinedAt: participant.createdAt.toISOString(),
    status: participant.status,
    hashedUserId: participant.hashedUserId,
  }))
}

async function creditWinner(roundId: string, userId: string, rewardAmount: number, trigger: "auto" | "manual") {
  await Balance.updateOne(
    { userId },
    {
      $inc: { current: rewardAmount, totalBalance: rewardAmount, totalEarning: rewardAmount },
    },
  )

  const tx = await Transaction.create({
    userId,
    type: "blindBoxReward",
    amount: rewardAmount,
    status: "approved",
    meta: { roundId, trigger },
  })

  return tx
}

export async function finalizeBlindBoxRound(
  roundId: string,
  options: { trigger?: "auto" | "manual"; winnerId?: string | null; startNextRound?: boolean } = {},
) {
  const { config } = await ensureSettings()
  const round = await BlindBoxRound.findById(roundId)
  if (!round) {
    throw new BlindBoxServiceError("Round not found", 404)
  }

  if (round.status === "completed") {
    return round
  }

  const participants = await BlindBoxParticipant.find({ roundId: round._id, status: "active" })
  let winnerParticipant = null

  if (participants.length > 0) {
    if (options.winnerId) {
      winnerParticipant = participants.find((participant) => participant.userId.toString() === options.winnerId)
      if (!winnerParticipant) {
        throw new BlindBoxServiceError("Specified winner is not a participant in this round", 400)
      }
    } else {
      const index = participants.length === 1 ? 0 : randomInt(participants.length)
      winnerParticipant = participants[index]
    }
  }

  let payoutTxId: string | null = null
  let winnerSnapshot: BlindBoxSummaryRoundPayload["winnerSnapshot"] | null = null

  if (winnerParticipant) {
    const payoutTx = await creditWinner(round._id.toString(), winnerParticipant.userId.toString(), round.rewardAmount, options.trigger ?? "auto")
    payoutTxId = payoutTx._id.toString()

    const winnerUser = await User.findById(winnerParticipant.userId)
    if (winnerUser) {
      winnerSnapshot = {
        name: winnerUser.name ?? "",
        referralCode: winnerUser.referralCode ?? "",
        email: winnerUser.email ?? "",
        creditedAt: new Date().toISOString(),
      }
    }

    await Notification.create({
      userId: winnerParticipant.userId,
      title: "You won the Blind Box!",
      body: `Congratulations! You have won $${round.rewardAmount} in the Blind Box draw.`,
      kind: "blindbox-won",
      metadata: { roundId: String(round._id), amount: round.rewardAmount },
    })
  }

  await BlindBoxRound.updateOne(
    { _id: round._id },
    {
      status: "completed",
      winnerUserId: winnerParticipant?.userId ?? null,
      winnerSnapshot: winnerSnapshot
        ? {
            userId: winnerParticipant?.userId ?? null,
            name: winnerSnapshot.name,
            email: winnerSnapshot.email,
            referralCode: winnerSnapshot.referralCode,
            creditedAt: winnerSnapshot.creditedAt ? new Date(winnerSnapshot.creditedAt) : null,
          }
        : null,
      payoutTxId,
      endTime: new Date(),
    },
  )

  if (options.startNextRound !== false) {
    await createNewRound(config)
  }

  return BlindBoxRound.findById(round._id)
}

export async function getBlindBoxSummaryForUser(userId: string): Promise<BlindBoxSummaryResponse> {
  const { round, config } = await ensureCurrentBlindBoxRound()
  const previousRound = await loadLatestCompletedRound()

  let activeParticipants = 0
  if (round) {
    activeParticipants = await BlindBoxParticipant.countDocuments({ roundId: round._id, status: "active" })
  }

  const [participant, latestEntryTransaction] = await Promise.all([
    round ? BlindBoxParticipant.findOne({ roundId: round._id, userId }) : null,
    Transaction.findOne({ userId, type: "blindBoxEntry" }).sort({ createdAt: -1 }),
  ])

  return {
    round: round
      ? {
          id: round._id.toString(),
          status: round.status,
          startTime: round.startTime.toISOString(),
          endTime: round.endTime.toISOString(),
          totalParticipants: activeParticipants,
          rewardAmount: round.rewardAmount,
          depositAmount: round.depositAmount,
          winnerSnapshot: round.winnerSnapshot
            ? {
                name: round.winnerSnapshot.name,
                referralCode: round.winnerSnapshot.referralCode ?? null,
                email: round.winnerSnapshot.email ?? null,
                creditedAt: round.winnerSnapshot.creditedAt
                  ? new Date(round.winnerSnapshot.creditedAt).toISOString()
                  : null,
              }
            : null,
          winnerUserId: round.winnerUserId ? round.winnerUserId.toString() : null,
        }
      : null,
    previousRound: previousRound
      ? {
          id: previousRound._id.toString(),
          status: previousRound.status,
          startTime: previousRound.startTime.toISOString(),
          endTime: previousRound.endTime.toISOString(),
          totalParticipants: previousRound.totalParticipants,
          rewardAmount: previousRound.rewardAmount,
          depositAmount: previousRound.depositAmount,
          winnerSnapshot: previousRound.winnerSnapshot
            ? {
                name: previousRound.winnerSnapshot.name,
                referralCode: previousRound.winnerSnapshot.referralCode ?? null,
                email: previousRound.winnerSnapshot.email ?? null,
                creditedAt: previousRound.winnerSnapshot.creditedAt
                  ? new Date(previousRound.winnerSnapshot.creditedAt).toISOString()
                  : null,
              }
            : null,
          winnerUserId: previousRound.winnerUserId ? previousRound.winnerUserId.toString() : null,
        }
      : null,
    nextDrawAt: round ? round.endTime.toISOString() : null,
    participants: activeParticipants,
    config,
    userStatus: {
      isParticipant: Boolean(participant),
      joinedAt: participant ? participant.createdAt.toISOString() : null,
      lastEntryTransactionId: latestEntryTransaction ? latestEntryTransaction._id.toString() : null,
    },
  }
}

export async function updateBlindBoxSettings(update: Partial<BlindBoxConfig>) {
  const { settingsId, config: current } = await ensureSettings()
  const nextConfig: BlindBoxConfig = {
    depositAmount: update.depositAmount && update.depositAmount > 0 ? update.depositAmount : current.depositAmount,
    rewardAmount: update.rewardAmount && update.rewardAmount > 0 ? update.rewardAmount : current.rewardAmount,
    cycleHours: update.cycleHours && update.cycleHours > 0 ? update.cycleHours : current.cycleHours,
    autoDrawEnabled:
      typeof update.autoDrawEnabled === "boolean" ? update.autoDrawEnabled : current.autoDrawEnabled,
  }

  await Settings.updateOne(
    { _id: settingsId },
    {
      $set: {
        blindBox: nextConfig,
      },
    },
  )

  return nextConfig
}

export async function runBlindBoxAutoDraw() {
  const { round, config } = await ensureCurrentBlindBoxRound()
  if (!round) return null

  const now = new Date()
  if (round.endTime <= now && config.autoDrawEnabled) {
    return finalizeBlindBoxRound(round._id.toString(), { trigger: "auto", startNextRound: true })
  }

  return round
}

export async function listBlindBoxRounds(limit = 20) {
  await ensureSettings()
  const rounds = await BlindBoxRound.find({})
    .sort({ startTime: -1 })
    .limit(limit)

  return rounds.map((round) => ({
    id: round._id.toString(),
    startTime: round.startTime.toISOString(),
    endTime: round.endTime.toISOString(),
    status: round.status,
    totalParticipants: round.totalParticipants,
    rewardAmount: round.rewardAmount,
    depositAmount: round.depositAmount,
    winnerUserId: round.winnerUserId ? round.winnerUserId.toString() : null,
    winnerSnapshot: round.winnerSnapshot
      ? {
          name: round.winnerSnapshot.name,
          referralCode: round.winnerSnapshot.referralCode ?? null,
          email: round.winnerSnapshot.email ?? null,
          creditedAt: round.winnerSnapshot.creditedAt
            ? new Date(round.winnerSnapshot.creditedAt).toISOString()
            : null,
        }
      : null,
  }))
}

export async function getBlindBoxAdminSummary() {
  const { round, config } = await ensureCurrentBlindBoxRound()
  const previousRound = await loadLatestCompletedRound()

  const participants = round ? await getBlindBoxParticipants(round._id.toString()) : []

  return {
    round: round
      ? {
          id: round._id.toString(),
          startTime: round.startTime.toISOString(),
          endTime: round.endTime.toISOString(),
          totalParticipants: round.totalParticipants,
          rewardAmount: round.rewardAmount,
          depositAmount: round.depositAmount,
          status: round.status,
        }
      : null,
    previousRound: previousRound
      ? {
          id: previousRound._id.toString(),
          startTime: previousRound.startTime.toISOString(),
          endTime: previousRound.endTime.toISOString(),
          totalParticipants: previousRound.totalParticipants,
          rewardAmount: previousRound.rewardAmount,
          winnerSnapshot: previousRound.winnerSnapshot
            ? {
                name: previousRound.winnerSnapshot.name,
                referralCode: previousRound.winnerSnapshot.referralCode ?? null,
                email: previousRound.winnerSnapshot.email ?? null,
                creditedAt: previousRound.winnerSnapshot.creditedAt
                  ? new Date(previousRound.winnerSnapshot.creditedAt).toISOString()
                  : null,
              }
            : null,
        }
      : null,
    participants,
    config,
  }
}
