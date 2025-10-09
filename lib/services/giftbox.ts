import crypto from "crypto"

import dbConnect from "@/lib/mongodb"
import Balance from "@/models/Balance"
import GiftBoxCycle, { type GiftBoxCycleStatus, type IGiftBoxCycle } from "@/models/GiftBoxCycle"
import GiftBoxDeposit, { type GiftBoxDepositStatus, type IGiftBoxDeposit } from "@/models/GiftBoxDeposit"
import GiftBoxParticipant from "@/models/GiftBoxParticipant"
import Notification from "@/models/Notification"
import Settings from "@/models/Settings"
import Transaction from "@/models/Transaction"
import User from "@/models/User"

const DEFAULT_TICKET_PRICE = 10
const DEFAULT_PAYOUT_PERCENTAGE = 90
const DEFAULT_CYCLE_HOURS = 72
const DEFAULT_WINNERS = 1
const DEFAULT_REFUND_PERCENTAGE = 0
const DEFAULT_DEPOSIT_ADDRESS = "TRhSCE8igyVmMuuRqukZEQDkn3MuEAdvfw"
const GIFT_BOX_REWARD_AMOUNT = 30

export type GiftBoxDrawTrigger = "auto" | "manual"

export interface GiftBoxConfig {
  ticketPrice: number
  payoutPercentage: number
  cycleHours: number
  winnersCount: number
  autoDrawEnabled: boolean
  refundPercentage: number
  depositAddress: string
}

export interface GiftBoxCycleSummaryPayload {
  id: string
  status: GiftBoxCycleStatus
  startTime: string
  endTime: string
  totalParticipants: number
  ticketPrice: number
  payoutPercentage: number
  winnerSnapshot: {
    name: string
    referralCode?: string | null
    email?: string | null
    creditedAt?: string | null
    payoutTxId?: string | null
  } | null
  winnerUserId: string | null
  fairnessProof: IGiftBoxCycle["fairnessProof"] | null
}

export interface GiftBoxSummaryResponse {
  cycle: GiftBoxCycleSummaryPayload | null
  previousCycle: GiftBoxCycleSummaryPayload | null
  nextDrawAt: string | null
  participants: number
  config: GiftBoxConfig
  userStatus: {
    isParticipant: boolean
    joinedAt: string | null
    lastEntryTransactionId: string | null
    pendingDeposit: {
      id: string
      status: GiftBoxDepositStatus
      submittedAt: string
      reviewedAt: string | null
      rejectionReason: string | null
      txId: string
      network: string
      address: string
      amount: number
      transactionId: string | null
      receipt: {
        url: string | null
        uploadedAt: string | null
      } | null
    } | null
  }
}

export interface GiftBoxDepositDetails {
  txId: string
  network?: string | null
  address?: string | null
}

export class GiftBoxServiceError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

function defaultConfig(): GiftBoxConfig {
  return {
    ticketPrice: DEFAULT_TICKET_PRICE,
    payoutPercentage: DEFAULT_PAYOUT_PERCENTAGE,
    cycleHours: DEFAULT_CYCLE_HOURS,
    winnersCount: DEFAULT_WINNERS,
    autoDrawEnabled: true,
    refundPercentage: DEFAULT_REFUND_PERCENTAGE,
    depositAddress: DEFAULT_DEPOSIT_ADDRESS,
  }
}

function normalizeConfig(raw: any): GiftBoxConfig {
  const defaults = defaultConfig()
  if (!raw) {
    return defaults
  }

  const ticketPrice = Number(raw.ticketPrice)
  const payoutPercentage = Number(raw.payoutPercentage)
  const cycleHours = Number(raw.cycleHours)
  const winnersCount = Number(raw.winnersCount)
  const refundPercentage = Number(raw.refundPercentage)
  const depositAddress = typeof raw.depositAddress === "string" && raw.depositAddress.trim().length > 0
    ? raw.depositAddress.trim()
    : defaults.depositAddress

  return {
    ticketPrice: Number.isFinite(ticketPrice) && ticketPrice > 0 ? ticketPrice : defaults.ticketPrice,
    payoutPercentage:
      Number.isFinite(payoutPercentage) && payoutPercentage >= 0 && payoutPercentage <= 100
        ? payoutPercentage
        : defaults.payoutPercentage,
    cycleHours: Number.isFinite(cycleHours) && cycleHours > 0 ? cycleHours : defaults.cycleHours,
    winnersCount:
      Number.isFinite(winnersCount) && winnersCount > 0 ? Math.floor(winnersCount) : defaults.winnersCount,
    autoDrawEnabled: typeof raw.autoDrawEnabled === "boolean" ? raw.autoDrawEnabled : defaults.autoDrawEnabled,
    refundPercentage:
      Number.isFinite(refundPercentage) && refundPercentage >= 0 && refundPercentage <= 100
        ? refundPercentage
        : defaults.refundPercentage,
    depositAddress,
  }
}

function hasConfigChanged(existing: any, config: GiftBoxConfig) {
  if (!existing) return true
  return (
    existing.ticketPrice !== config.ticketPrice ||
    existing.payoutPercentage !== config.payoutPercentage ||
    existing.cycleHours !== config.cycleHours ||
    existing.autoDrawEnabled !== config.autoDrawEnabled ||
    existing.winnersCount !== config.winnersCount ||
    existing.refundPercentage !== config.refundPercentage ||
    existing.depositAddress !== config.depositAddress
  )
}

async function ensureSettings(): Promise<{ config: GiftBoxConfig; settingsId: string }> {
  await dbConnect()
  let settings = await Settings.findOne()
  if (!settings) {
    settings = await Settings.create({ giftBox: defaultConfig() })
  }

  const config = normalizeConfig(settings.giftBox)
  if (!settings.giftBox || hasConfigChanged(settings.giftBox, config)) {
    await Settings.updateOne(
      { _id: settings._id },
      {
        $set: {
          giftBox: config,
        },
      },
    )
  }

  return { config, settingsId: String(settings._id) }
}

export async function getGiftBoxConfig(): Promise<GiftBoxConfig> {
  const { config } = await ensureSettings()
  return config
}

async function loadLatestCompletedCycle() {
  const [cycle] = await GiftBoxCycle.find({ status: "completed" }).sort({ endTime: -1 }).limit(1)
  return cycle ?? null
}

async function findOpenCycle() {
  const [cycle] = await GiftBoxCycle.find({ status: "open" }).sort({ startTime: -1 }).limit(1)
  return cycle ?? null
}

async function createNewCycle(config: GiftBoxConfig) {
  const now = new Date()
  const endTime = new Date(now.getTime() + config.cycleHours * 60 * 60 * 1000)
  const created = await GiftBoxCycle.create({
    status: "open",
    startTime: now,
    endTime,
    ticketPrice: config.ticketPrice,
    payoutPercentage: config.payoutPercentage,
    totalParticipants: 0,
    fairnessProof: null,
  })
  return GiftBoxCycle.findById(created._id)
}

export async function ensureCurrentGiftBoxCycle() {
  const { config } = await ensureSettings()
  let cycle = await findOpenCycle()
  const now = new Date()

  if (cycle && cycle.endTime <= now && config.autoDrawEnabled) {
    await finalizeGiftBoxCycle(cycle._id.toString(), { trigger: "auto", startNextCycle: true })
    cycle = null
  }

  if (!cycle) {
    cycle = await createNewCycle(config)
  }

  return { cycle, config }
}

function hashUserId(userId: string) {
  return crypto.createHash("sha256").update(userId).digest("hex")
}

function buildClientSeed(participants: Array<{ hashedUserId: string }>) {
  if (!participants.length) {
    return crypto.randomBytes(16).toString("hex")
  }
  return crypto.createHash("sha256").update(participants.map((p) => p.hashedUserId).join(":"), "utf8").digest("hex")
}

function buildFairnessProof(
  participants: Array<{ hashedUserId: string }>,
  serverSeed: string,
  clientSeed?: string,
  nonce?: number,
) {
  const seedNonce = typeof nonce === "number" && nonce >= 0 ? nonce : participants.length
  const normalizedClientSeed = clientSeed && clientSeed.length > 0 ? clientSeed : buildClientSeed(participants)
  const payload = `${serverSeed}:${normalizedClientSeed}:${seedNonce}`
  const hash = crypto.createHash("sha256").update(payload, "utf8").digest("hex")
  const winnerIndex = participants.length === 0 ? 0 : parseInt(hash.slice(0, 16), 16) % Math.max(participants.length, 1)

  return { serverSeed, clientSeed: normalizedClientSeed, nonce: seedNonce, hash, winnerIndex }
}

export async function joinGiftBoxCycle(userId: string, deposit: GiftBoxDepositDetails) {
  const { cycle, config } = await ensureCurrentGiftBoxCycle()
  if (!cycle) {
    throw new GiftBoxServiceError("No active giveaway cycle is available", 400)
  }

  if (!deposit || typeof deposit.txId !== "string" || deposit.txId.trim().length === 0) {
    throw new GiftBoxServiceError("A deposit transaction hash is required to join", 400)
  }

  await dbConnect()

  if (cycle.endTime <= new Date()) {
    throw new GiftBoxServiceError("The current giveaway cycle has already closed", 400)
  }

  const existing = await GiftBoxParticipant.findOne({ cycleId: cycle._id, userId })
  if (existing) {
    throw new GiftBoxServiceError("You have already joined this giveaway cycle", 409)
  }

  const normalizedTxId = deposit.txId.trim()
  if (normalizedTxId.length < 10) {
    throw new GiftBoxServiceError("Enter a valid deposit transaction hash", 400)
  }

  const duplicateDeposit = await GiftBoxDeposit.findOne({ txId: normalizedTxId })
  if (duplicateDeposit) {
    throw new GiftBoxServiceError("This deposit transaction has already been used", 409)
  }

  const confirmedDepositTx = await Transaction.findOne({
    userId,
    type: "deposit",
    status: "approved",
    $or: [
      { "meta.transactionHash": normalizedTxId },
      { "meta.transactionNumber": normalizedTxId },
    ],
  })
    .sort({ createdAt: -1 })
    .exec()

  if (!confirmedDepositTx) {
    throw new GiftBoxServiceError(
      "We couldn't confirm this deposit on-chain yet. Wait for final confirmation and try again.",
      400,
    )
  }

  const duplicateByTransaction = await GiftBoxDeposit.findOne({ transactionId: confirmedDepositTx._id })
  if (duplicateByTransaction) {
    throw new GiftBoxServiceError("This confirmed deposit has already been submitted for the giveaway", 409)
  }

  const confirmedAmount = Number(confirmedDepositTx.amount)
  if (!Number.isFinite(confirmedAmount) || confirmedAmount < config.ticketPrice) {
    throw new GiftBoxServiceError(
      `Confirmed deposits must be at least $${config.ticketPrice} to enter the giveaway`,
      400,
    )
  }

  const receiptMeta =
    confirmedDepositTx.meta && typeof confirmedDepositTx.meta === "object"
      ? (confirmedDepositTx.meta as any).receipt ?? null
      : null

  if (!receiptMeta || typeof receiptMeta.url !== "string") {
    throw new GiftBoxServiceError(
      "Upload your exchange receipt to the original deposit before submitting it for the Gift Box.",
      400,
    )
  }

  const network = (deposit.network ?? "TRC20").toString().trim() || "TRC20"
  const address = (deposit.address ?? config.depositAddress).toString().trim() || config.depositAddress

  const depositRecord = await GiftBoxDeposit.create({
    userId,
    amount: config.ticketPrice,
    network,
    address,
    txId: normalizedTxId,
    status: "pending",
    cycleId: cycle._id,
    reviewedAt: null,
    reviewedBy: null,
    transactionId: confirmedDepositTx._id,
    receipt: receiptMeta,
  })

  await Transaction.create({
    userId,
    type: "giftBoxDeposit",
    amount: config.ticketPrice,
    status: "pending",
    meta: {
      cycleId: String(cycle._id),
      depositId: depositRecord._id.toString(),
      txId: normalizedTxId,
      network,
      address,
      sourceTransactionId: confirmedDepositTx._id.toString(),
    },
  })

  await Transaction.updateOne(
    { _id: confirmedDepositTx._id },
    {
      $set: {
        "meta.giftBoxDepositId": depositRecord._id.toString(),
        "meta.giftBoxCycleId": cycle._id.toString(),
      },
    },
  ).catch((error) => {
    console.error("Failed to tag confirmed deposit with gift box metadata", error)
  })

  await Notification.create({
    userId,
    title: "Your deposit is under review.",
    body: `We received your $${config.ticketPrice} Gift Box deposit submission. You'll be notified after the review is complete.`,
    kind: "giftbox-deposit-submitted",
    metadata: { cycleId: String(cycle._id), depositId: depositRecord._id.toString() },
  })

  return { deposit: depositRecord, cycle }
}

async function grantGiftBoxReward(deposit: IGiftBoxDeposit, cycleId?: string | null) {
  if (deposit.rewardTransactionId) {
    return deposit.rewardTransactionId.toString()
  }

  await Balance.updateOne(
    { userId: deposit.userId },
    {
      $inc: {
        current: GIFT_BOX_REWARD_AMOUNT,
        totalBalance: GIFT_BOX_REWARD_AMOUNT,
        totalEarning: GIFT_BOX_REWARD_AMOUNT,
      },
      $setOnInsert: {
        current: 0,
        totalBalance: 0,
        totalEarning: 0,
        lockedCapital: 0,
        lockedCapitalLots: [],
        staked: 0,
        pendingWithdraw: 0,
        teamRewardsAvailable: 0,
        teamRewardsClaimed: 0,
      },
    },
    { upsert: true },
  )

  const rewardTx = await Transaction.create({
    userId: deposit.userId,
    type: "giftBoxReward",
    amount: GIFT_BOX_REWARD_AMOUNT,
    status: "approved",
    meta: {
      cycleId: cycleId ?? (deposit.cycleId ? deposit.cycleId.toString() : null),
      depositId: deposit._id.toString(),
      sourceTransactionId: deposit.transactionId ? deposit.transactionId.toString() : null,
    },
  })

  await GiftBoxDeposit.updateOne(
    { _id: deposit._id },
    {
      $set: {
        rewardTransactionId: rewardTx._id,
        rewardAmount: GIFT_BOX_REWARD_AMOUNT,
        rewardedAt: new Date(),
      },
    },
  )

  return rewardTx._id.toString()
}

export async function approveGiftBoxDeposit(depositId: string, adminUserId: string) {
  await dbConnect()
  const deposit = await GiftBoxDeposit.findById(depositId)
  if (!deposit) {
    throw new GiftBoxServiceError("Deposit not found", 404)
  }

  if (deposit.status !== "pending") {
    throw new GiftBoxServiceError("This deposit has already been reviewed", 409)
  }

  const cycle = deposit.cycleId ? await GiftBoxCycle.findById(deposit.cycleId) : null
  if (!cycle || cycle.status !== "open") {
    throw new GiftBoxServiceError("The associated giveaway cycle is not accepting deposits", 400)
  }

  const existingParticipant = await GiftBoxParticipant.findOne({ cycleId: cycle._id, userId: deposit.userId })
  if (existingParticipant) {
    await GiftBoxDeposit.updateOne(
      { _id: deposit._id },
      {
        $set: {
          status: "approved",
          reviewedAt: new Date(),
          reviewedBy: adminUserId,
          rejectionReason: null,
        },
      },
    )

    const refreshedDeposit = await GiftBoxDeposit.findById(deposit._id)
    const rewardTransactionId = refreshedDeposit
      ? await grantGiftBoxReward(refreshedDeposit, cycle._id ? cycle._id.toString() : null)
      : null

    await Transaction.updateMany(
      { type: "giftBoxDeposit", "meta.depositId": deposit._id.toString() },
      { $set: { status: "approved" } },
    )
    await Notification.create({
      userId: deposit.userId,
      title: "Gift Box entry approved",
      body: `Your deposit has been verified. We've credited a $${GIFT_BOX_REWARD_AMOUNT} Gift Box reward to your wallet.`,
      kind: "giftbox-deposit-approved",
      metadata: {
        cycleId: String(cycle._id),
        depositId: deposit._id.toString(),
        entryTransactionId: null,
        rewardTransactionId,
      },
    })
    return GiftBoxParticipant.findById(existingParticipant._id)
  }

  const participant = await GiftBoxParticipant.create({
    userId: deposit.userId,
    cycleId: cycle._id,
    depositId: deposit._id,
    hashedUserId: hashUserId(deposit.userId.toString()),
    status: "active",
  })

  await GiftBoxCycle.updateOne({ _id: cycle._id }, { $inc: { totalParticipants: 1 } })

  const depositTransaction = await Transaction.findOneAndUpdate(
    { type: "giftBoxDeposit", "meta.depositId": deposit._id.toString() },
    { $set: { status: "approved" } },
    { new: true },
  )

  const entryTransaction = await Transaction.create({
    userId: deposit.userId,
    type: "giftBoxEntry",
    amount: deposit.amount,
    status: "approved",
    meta: {
      cycleId: String(cycle._id),
      depositId: deposit._id.toString(),
      depositTransactionId: depositTransaction ? depositTransaction._id.toString() : null,
    },
  })

  await GiftBoxDeposit.updateOne(
    { _id: deposit._id },
    {
      $set: {
        status: "approved",
        reviewedAt: new Date(),
        reviewedBy: adminUserId,
        rejectionReason: null,
      },
    },
  )

  const refreshedDeposit = await GiftBoxDeposit.findById(deposit._id)
  const rewardTransactionId = refreshedDeposit
    ? await grantGiftBoxReward(refreshedDeposit, cycle._id ? cycle._id.toString() : null)
    : null

  await Notification.create({
    userId: deposit.userId,
    title: "Gift Box entry approved",
    body: `Your deposit has been verified. We've credited a $${GIFT_BOX_REWARD_AMOUNT} Gift Box reward to your wallet.`,
    kind: "giftbox-deposit-approved",
    metadata: {
      cycleId: String(cycle._id),
      depositId: deposit._id.toString(),
      entryTransactionId: entryTransaction._id.toString(),
      rewardTransactionId,
    },
  })

  return participant
}

export async function rejectGiftBoxDeposit(depositId: string, adminUserId: string, reason?: string) {
  await dbConnect()
  const deposit = await GiftBoxDeposit.findById(depositId)
  if (!deposit) {
    throw new GiftBoxServiceError("Deposit not found", 404)
  }

  if (deposit.status !== "pending") {
    throw new GiftBoxServiceError("This deposit has already been reviewed", 409)
  }

  const rejectionReason = reason && reason.trim().length > 0 ? reason.trim() : "Deposit could not be verified."

  await GiftBoxDeposit.updateOne(
    { _id: deposit._id },
    {
      $set: {
        status: "rejected",
        reviewedAt: new Date(),
        reviewedBy: adminUserId,
        rejectionReason,
      },
    },
  )

  await Transaction.updateMany(
    { type: "giftBoxDeposit", "meta.depositId": deposit._id.toString() },
    { $set: { status: "rejected" } },
  )

  await Notification.create({
    userId: deposit.userId,
    title: "Gift Box deposit rejected",
    body: `Your Gift Box deposit was rejected. Reason: ${rejectionReason}. Please submit a new, confirmed transaction hash to try again.`,
    kind: "giftbox-deposit-rejected",
    metadata: {
      cycleId: deposit.cycleId ? deposit.cycleId.toString() : null,
      depositId: deposit._id.toString(),
      reason: rejectionReason,
    },
  })
}

export async function getGiftBoxParticipants(cycleId: string) {
  await ensureSettings()

  const participants = await GiftBoxParticipant.find({ cycleId })
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

async function creditWinner(cycleId: string, userId: string, payoutAmount: number, trigger: GiftBoxDrawTrigger) {
  await Balance.updateOne(
    { userId },
    {
      $inc: { current: payoutAmount, totalBalance: payoutAmount, totalEarning: payoutAmount },
    },
  )

  const tx = await Transaction.create({
    userId,
    type: "giftBoxPayout",
    amount: payoutAmount,
    status: "approved",
    meta: { cycleId, trigger },
  })

  return tx
}

export async function finalizeGiftBoxCycle(
  cycleId: string,
  options: {
    trigger?: GiftBoxDrawTrigger
    winnerId?: string | null
    startNextCycle?: boolean
    serverSeed?: string
    clientSeed?: string
    nonce?: number
  } = {},
) {
  const { config } = await ensureSettings()
  const cycle = await GiftBoxCycle.findById(cycleId)
  if (!cycle) {
    throw new GiftBoxServiceError("Giveaway cycle not found", 404)
  }

  if (cycle.status === "completed") {
    return cycle
  }

  const participants = await GiftBoxParticipant.find({ cycleId: cycle._id, status: "active" })
  if (!participants.length) {
    await GiftBoxCycle.updateOne({ _id: cycle._id }, { status: "completed", endTime: new Date() })
    return GiftBoxCycle.findById(cycle._id)
  }

  let winnerParticipant = null
  if (options.winnerId) {
    winnerParticipant = participants.find((participant) => participant.userId.toString() === options.winnerId)
    if (!winnerParticipant) {
      throw new GiftBoxServiceError("Specified winner is not a participant in this cycle", 400)
    }
  }

  const serverSeed = options.serverSeed ?? crypto.randomBytes(32).toString("hex")
  const fairness = buildFairnessProof(
    participants.map((p) => ({ hashedUserId: p.hashedUserId })),
    serverSeed,
    options.clientSeed,
    options.nonce,
  )
  const resolvedIndex = Math.min(fairness.winnerIndex, participants.length - 1)
  winnerParticipant = winnerParticipant ?? participants[resolvedIndex]

  const potAmount = cycle.totalParticipants * cycle.ticketPrice
  const payoutAmount = Math.round((potAmount * config.payoutPercentage) / 100)

  const payoutTx = await creditWinner(cycle._id.toString(), winnerParticipant.userId.toString(), payoutAmount, options.trigger ?? "auto")

  const winnerUser = await User.findById(winnerParticipant.userId)
  const winnerSnapshot = winnerUser
    ? {
        name: winnerUser.name ?? "",
        referralCode: winnerUser.referralCode ?? "",
        email: winnerUser.email ?? "",
        creditedAt: new Date().toISOString(),
        payoutTxId: payoutTx._id.toString(),
      }
    : null

  await GiftBoxCycle.updateOne(
    { _id: cycle._id },
    {
      status: "completed",
      winnerUserId: winnerParticipant.userId,
      winnerSnapshot: winnerSnapshot
        ? {
            userId: winnerParticipant.userId,
            name: winnerSnapshot.name,
            referralCode: winnerSnapshot.referralCode,
            email: winnerSnapshot.email,
            creditedAt: winnerSnapshot.creditedAt ? new Date(winnerSnapshot.creditedAt) : null,
          }
        : null,
      payoutTxId: payoutTx._id,
      fairnessProof,
      endTime: new Date(),
    },
  )

  await Notification.create({
    userId: winnerParticipant.userId,
    title: "You won the Gift Box Giveaway!",
    body: `Congratulations! You have won $${payoutAmount} from the Gift Box pot.`,
    kind: "giftbox-won",
    metadata: { cycleId: String(cycle._id), amount: payoutAmount, payoutTxId: payoutTx._id.toString() },
  })

  if (options.startNextCycle !== false) {
    const nextCycle = await createNewCycle(config)
    await Promise.all(
      participants.map((participant) =>
        Notification.create({
          userId: participant.userId,
          title: "New Gift Box cycle started",
          body: "A fresh Gift Box Giveaway cycle is live. Join again for another chance to win!",
          kind: "giftbox-cycle-started",
          metadata: { previousCycleId: cycle._id.toString(), nextCycleId: nextCycle?._id.toString() },
        }).catch((error) => {
          console.error("Failed to publish gift box cycle start notification", error)
        }),
      ),
    )
  }

  return GiftBoxCycle.findById(cycle._id)
}

export async function getGiftBoxSummaryForUser(userId: string): Promise<GiftBoxSummaryResponse> {
  const { cycle, config } = await ensureCurrentGiftBoxCycle()
  const previousCycle = await loadLatestCompletedCycle()

  let activeParticipants = 0
  if (cycle) {
    activeParticipants = await GiftBoxParticipant.countDocuments({ cycleId: cycle._id, status: "active" })
  }

  const [participant, latestEntryTransaction, latestDeposit] = await Promise.all([
    cycle ? GiftBoxParticipant.findOne({ cycleId: cycle._id, userId }) : null,
    Transaction.findOne({ userId, type: "giftBoxEntry" }).sort({ createdAt: -1 }),
    cycle ? GiftBoxDeposit.findOne({ cycleId: cycle._id, userId }).sort({ createdAt: -1 }) : null,
  ])

  const mapCycle = (entity: IGiftBoxCycle | null): GiftBoxCycleSummaryPayload | null => {
    if (!entity) return null
    return {
      id: entity._id.toString(),
      status: entity.status,
      startTime: entity.startTime.toISOString(),
      endTime: entity.endTime.toISOString(),
      totalParticipants: entity.totalParticipants,
      ticketPrice: entity.ticketPrice,
      payoutPercentage: entity.payoutPercentage,
      winnerSnapshot: entity.winnerSnapshot
        ? {
            name: entity.winnerSnapshot.name,
            referralCode: entity.winnerSnapshot.referralCode ?? null,
            email: entity.winnerSnapshot.email ?? null,
            creditedAt: entity.winnerSnapshot.creditedAt
              ? new Date(entity.winnerSnapshot.creditedAt).toISOString()
              : null,
            payoutTxId: entity.payoutTxId ? entity.payoutTxId.toString() : null,
          }
        : null,
      winnerUserId: entity.winnerUserId ? entity.winnerUserId.toString() : null,
      fairnessProof: entity.fairnessProof ?? null,
    }
  }

  return {
    cycle: mapCycle(cycle),
    previousCycle: mapCycle(previousCycle),
    nextDrawAt: cycle ? cycle.endTime.toISOString() : null,
    participants: activeParticipants,
    config,
    userStatus: {
      isParticipant: Boolean(participant),
      joinedAt: participant ? participant.createdAt.toISOString() : null,
      lastEntryTransactionId: latestEntryTransaction ? latestEntryTransaction._id.toString() : null,
        pendingDeposit: latestDeposit
          ? {
              id: latestDeposit._id.toString(),
              status: latestDeposit.status,
              submittedAt: latestDeposit.createdAt.toISOString(),
              reviewedAt: latestDeposit.reviewedAt ? latestDeposit.reviewedAt.toISOString() : null,
              rejectionReason: latestDeposit.rejectionReason ?? null,
              txId: latestDeposit.txId,
              network: latestDeposit.network,
              address: latestDeposit.address,
              amount: latestDeposit.amount,
              transactionId: latestDeposit.transactionId ? latestDeposit.transactionId.toString() : null,
              receipt:
                latestDeposit.receipt && typeof latestDeposit.receipt === "object"
                  ? {
                      url: typeof (latestDeposit.receipt as any).url === "string"
                        ? ((latestDeposit.receipt as any).url as string)
                        : null,
                      uploadedAt:
                        (latestDeposit.receipt as any).uploadedAt
                          ? new Date((latestDeposit.receipt as any).uploadedAt).toISOString()
                          : null,
                    }
                  : null,
            }
          : null,
      },
    }
  }

export async function updateGiftBoxSettings(update: Partial<GiftBoxConfig>) {
  const { settingsId, config: current } = await ensureSettings()
  const nextConfig: GiftBoxConfig = {
    ticketPrice: update.ticketPrice && update.ticketPrice > 0 ? update.ticketPrice : current.ticketPrice,
    payoutPercentage:
      typeof update.payoutPercentage === "number" && update.payoutPercentage >= 0 && update.payoutPercentage <= 100
        ? update.payoutPercentage
        : current.payoutPercentage,
    cycleHours: update.cycleHours && update.cycleHours > 0 ? update.cycleHours : current.cycleHours,
    winnersCount: update.winnersCount && update.winnersCount > 0 ? Math.floor(update.winnersCount) : current.winnersCount,
    autoDrawEnabled:
      typeof update.autoDrawEnabled === "boolean" ? update.autoDrawEnabled : current.autoDrawEnabled,
    refundPercentage:
      typeof update.refundPercentage === "number" && update.refundPercentage >= 0 && update.refundPercentage <= 100
        ? update.refundPercentage
        : current.refundPercentage,
    depositAddress:
      typeof update.depositAddress === "string" && update.depositAddress.trim().length > 0
        ? update.depositAddress.trim()
        : current.depositAddress,
  }

  await Settings.updateOne(
    { _id: settingsId },
    {
      $set: {
        giftBox: nextConfig,
      },
    },
  )

  return nextConfig
}

export async function runGiftBoxAutoDraw() {
  const { cycle, config } = await ensureCurrentGiftBoxCycle()
  if (!cycle) return null

  const now = new Date()
  if (cycle.endTime <= now && config.autoDrawEnabled) {
    return finalizeGiftBoxCycle(cycle._id.toString(), { trigger: "auto", startNextCycle: true })
  }

  return cycle
}

export async function listGiftBoxCycles(limit = 20) {
  await ensureSettings()
  const cycles = await GiftBoxCycle.find({})
    .sort({ startTime: -1 })
    .limit(limit)

  return cycles.map((cycle) => ({
    id: cycle._id.toString(),
    startTime: cycle.startTime.toISOString(),
    endTime: cycle.endTime.toISOString(),
    status: cycle.status,
    totalParticipants: cycle.totalParticipants,
    ticketPrice: cycle.ticketPrice,
    payoutPercentage: cycle.payoutPercentage,
    winnerUserId: cycle.winnerUserId ? cycle.winnerUserId.toString() : null,
    winnerSnapshot: cycle.winnerSnapshot
      ? {
          name: cycle.winnerSnapshot.name,
          referralCode: cycle.winnerSnapshot.referralCode ?? null,
          email: cycle.winnerSnapshot.email ?? null,
          creditedAt: cycle.winnerSnapshot.creditedAt
            ? new Date(cycle.winnerSnapshot.creditedAt).toISOString()
            : null,
          payoutTxId: cycle.payoutTxId ? cycle.payoutTxId.toString() : null,
        }
      : null,
    fairnessProof: cycle.fairnessProof ?? null,
  }))
}

export async function getGiftBoxAdminSummary() {
  const { cycle, config } = await ensureCurrentGiftBoxCycle()
  const previousCycle = await loadLatestCompletedCycle()

  const participants = cycle ? await getGiftBoxParticipants(cycle._id.toString()) : []
  const pendingDeposits =
    cycle
      ? await GiftBoxDeposit.find({ cycleId: cycle._id, status: "pending" })
          .sort({ createdAt: 1 })
          .populate("userId", "name email referralCode")
      : []

  return {
    cycle: cycle
      ? {
          id: cycle._id.toString(),
          startTime: cycle.startTime.toISOString(),
          endTime: cycle.endTime.toISOString(),
          totalParticipants: cycle.totalParticipants,
          ticketPrice: cycle.ticketPrice,
          payoutPercentage: cycle.payoutPercentage,
          status: cycle.status,
          fairnessProof: cycle.fairnessProof ?? null,
        }
      : null,
    previousCycle: previousCycle
      ? {
          id: previousCycle._id.toString(),
          startTime: previousCycle.startTime.toISOString(),
          endTime: previousCycle.endTime.toISOString(),
          totalParticipants: previousCycle.totalParticipants,
          ticketPrice: previousCycle.ticketPrice,
          payoutPercentage: previousCycle.payoutPercentage,
          winnerSnapshot: previousCycle.winnerSnapshot
            ? {
                name: previousCycle.winnerSnapshot.name,
                referralCode: previousCycle.winnerSnapshot.referralCode ?? null,
                email: previousCycle.winnerSnapshot.email ?? null,
                creditedAt: previousCycle.winnerSnapshot.creditedAt
                  ? new Date(previousCycle.winnerSnapshot.creditedAt).toISOString()
                  : null,
              }
            : null,
          fairnessProof: previousCycle.fairnessProof ?? null,
        }
      : null,
    participants,
      pendingDeposits: pendingDeposits.map((deposit) => ({
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
        network: deposit.network,
        address: deposit.address,
        amount: deposit.amount,
        submittedAt: deposit.createdAt.toISOString(),
        transactionId: deposit.transactionId ? deposit.transactionId.toString() : null,
        receipt:
          deposit.receipt && typeof deposit.receipt === "object"
            ? {
                url:
                  typeof (deposit.receipt as any).url === "string"
                    ? ((deposit.receipt as any).url as string)
                    : null,
                uploadedAt:
                  (deposit.receipt as any).uploadedAt
                    ? new Date((deposit.receipt as any).uploadedAt).toISOString()
                    : null,
              }
            : null,
      })),
    config,
  }
}
