import crypto from "crypto"
import { randomInt } from "crypto"

import dbConnect from "@/lib/mongodb"
import Balance from "@/models/Balance"
import BlindBoxDeposit, {
  type BlindBoxDepositStatus,
  type IBlindBoxDeposit,
} from "@/models/BlindBoxDeposit"
import BlindBoxParticipant from "@/models/BlindBoxParticipant"
import BlindBoxRound from "@/models/BlindBoxRound"
import Notification from "@/models/Notification"
import Settings from "@/models/Settings"
import Transaction from "@/models/Transaction"
import User from "@/models/User"

const DEFAULT_DEPOSIT_AMOUNT = 10
const DEFAULT_REWARD_AMOUNT = 30
const DEFAULT_CYCLE_HOURS = 72
const BLIND_BOX_DEPOSIT_ADDRESS = "TRhSCE8igyVmMuuRqukZEQDkn3MuEAdvfw"
const BLIND_BOX_NETWORK = "TRC20"

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
    hasPendingDeposit: boolean
    pendingTxId: string | null
    lastDepositStatus: BlindBoxDepositStatus | null
  }
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

export async function submitBlindBoxDeposit({
  userId,
  txId,
}: {
  userId: string
  txId: string
}) {
  const { config } = await ensureSettings()
  const sanitizedTxId = txId.trim()
  if (!sanitizedTxId) {
    throw new BlindBoxServiceError("Transaction hash is required", 400)
  }

  await dbConnect()
  const existing = await BlindBoxDeposit.findOne({ txId: sanitizedTxId })
  if (existing) {
    throw new BlindBoxServiceError("This transaction hash has already been submitted", 409)
  }

  const deposit = await BlindBoxDeposit.create({
    userId,
    amount: config.depositAmount,
    network: BLIND_BOX_NETWORK,
    address: BLIND_BOX_DEPOSIT_ADDRESS,
    txId: sanitizedTxId,
    status: "pending",
    type: "blindbox",
  })

  await Transaction.create({
    userId,
    type: "blindBoxDeposit",
    amount: config.depositAmount,
    status: "pending",
    meta: { txId: sanitizedTxId },
  })

  await Notification.create({
    userId,
    title: "Blind Box deposit submitted",
    body: "We have received your transaction hash. Our team will verify it shortly.",
    kind: "blindbox-submitted",
    metadata: { txId: sanitizedTxId },
  })

  return deposit
}

export async function listBlindBoxDeposits(status?: BlindBoxDepositStatus) {
  await ensureSettings()
  const query: Record<string, any> = {}
  if (status) {
    query.status = status
  }

  const deposits = await BlindBoxDeposit.find(query)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate("userId", "name email referralCode")
  return deposits
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

async function addParticipantToRound(roundId: string, deposit: IBlindBoxDeposit) {
  const hashedUserId = hashUserId(String(deposit.userId))
  const existing = await BlindBoxParticipant.findOne({ roundId, userId: deposit.userId })
  if (existing) {
    return existing
  }

  const participant = await BlindBoxParticipant.create({
    roundId,
    userId: deposit.userId,
    depositId: deposit._id,
    hashedUserId,
    status: "active",
  })

  await BlindBoxRound.updateOne({ _id: roundId }, { $inc: { totalParticipants: 1 } })
  return participant
}

export async function approveBlindBoxDeposit({ depositId, adminId }: { depositId: string; adminId: string }) {
  const { round } = await ensureCurrentBlindBoxRound()
  if (!round) {
    throw new BlindBoxServiceError("Unable to determine active round", 500)
  }

  const deposit = await BlindBoxDeposit.findById(depositId)
  if (!deposit) {
    throw new BlindBoxServiceError("Deposit not found", 404)
  }

  if (deposit.status !== "pending") {
    throw new BlindBoxServiceError("Deposit has already been reviewed", 409)
  }

  await BlindBoxDeposit.updateOne(
    { _id: deposit._id },
    { status: "approved", reviewedAt: new Date(), reviewedBy: adminId },
  )

  await addParticipantToRound(round._id.toString(), deposit)

  await Notification.create({
    userId: deposit.userId,
    title: "Blind Box deposit approved",
    body: "Your deposit has been verified. You are now entered into the current Blind Box round.",
    kind: "blindbox-approved",
    metadata: { roundId: String(round._id), txId: deposit.txId },
  })

  await Transaction.updateMany(
    { userId: deposit.userId, type: "blindBoxDeposit", "meta.txId": deposit.txId },
    { $set: { status: "approved", meta: { txId: deposit.txId, roundId: String(round._id) } } },
  )

  return true
}

export async function rejectBlindBoxDeposit({
  depositId,
  adminId,
  reason,
}: {
  depositId: string
  adminId: string
  reason?: string
}) {
  await ensureSettings()
  const deposit = await BlindBoxDeposit.findById(depositId)
  if (!deposit) {
    throw new BlindBoxServiceError("Deposit not found", 404)
  }

  if (deposit.status !== "pending") {
    throw new BlindBoxServiceError("Deposit has already been reviewed", 409)
  }

  await BlindBoxDeposit.updateOne(
    { _id: deposit._id },
    {
      status: "rejected",
      reviewedAt: new Date(),
      reviewedBy: adminId,
      rejectionReason: reason ?? null,
    },
  )

  await Notification.create({
    userId: deposit.userId,
    title: "Blind Box deposit rejected",
    body:
      reason
        ? `Your Blind Box deposit was rejected: ${reason}`
        : "We could not verify your Blind Box deposit. Please contact support.",
    kind: "blindbox-rejected",
    metadata: { txId: deposit.txId },
  })

  await Transaction.updateMany(
    { userId: deposit.userId, type: "blindBoxDeposit", "meta.txId": deposit.txId },
    { $set: { status: "rejected", meta: { txId: deposit.txId, reason: reason ?? null } } },
  )

  return true
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

  const [latestDeposit, participant] = await Promise.all([
    BlindBoxDeposit.findOne({ userId }).sort({ createdAt: -1 }),
    round ? BlindBoxParticipant.findOne({ roundId: round._id, userId }) : null,
  ])

  const pendingDeposit =
    latestDeposit && latestDeposit.status === "pending" &&
    (!round || latestDeposit.createdAt <= round.endTime)
      ? latestDeposit
      : null

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
      hasPendingDeposit: Boolean(pendingDeposit),
      pendingTxId: pendingDeposit ? pendingDeposit.txId : null,
      lastDepositStatus: latestDeposit ? latestDeposit.status : null,
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

export const BLIND_BOX_CONSTANTS = {
  address: BLIND_BOX_DEPOSIT_ADDRESS,
  network: BLIND_BOX_NETWORK,
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

  const [participants, pendingDeposits] = await Promise.all([
    round ? getBlindBoxParticipants(round._id.toString()) : Promise.resolve([] as any[]),
    BlindBoxDeposit.find({ status: "pending" })
      .sort({ createdAt: 1 })
      .limit(200)
      .populate("userId", "name email referralCode"),
  ])

  const normalizedDeposits = pendingDeposits.map((deposit) => ({
    id: deposit._id.toString(),
    user:
      deposit.userId && typeof deposit.userId === "object" && "_id" in deposit.userId
        ? {
            id: (deposit.userId as any)._id.toString(),
            name: (deposit.userId as any).name ?? "",
            email: (deposit.userId as any).email ?? "",
            referralCode: (deposit.userId as any).referralCode ?? "",
          }
        : null,
    txId: deposit.txId,
    amount: deposit.amount,
    status: deposit.status,
    createdAt: deposit.createdAt.toISOString(),
  }))

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
    pendingDeposits: normalizedDeposits,
    config,
  }
}
