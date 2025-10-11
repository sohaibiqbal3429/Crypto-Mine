import crypto from "crypto"
import mongoose from "mongoose"

import { getUserFromRequest } from "@/lib/auth"
import dbConnect from "@/lib/mongodb"
import BlindBoxBan from "@/models/BlindBoxBan"
import BlindBoxEntry from "@/models/BlindBoxEntry"
import BlindBoxRound from "@/models/BlindBoxRound"
import Log from "@/models/Log"
import Settings from "@/models/Settings"
import Transaction from "@/models/Transaction"
import User from "@/models/User"

const DEFAULT_ADDRESS = "Bep20"
const DEFAULT_NETWORK = "BEP20"
const DEFAULT_MIN_DEPOSIT = 10
const DEFAULT_ENTRY_VALUE = 10
const DEFAULT_ROUND_DURATION_HOURS = 72
const DEFAULT_PRIZE_POOL_PERCENT = 100

export interface GiftBoxSettings {
  roundDurationHours: number
  minDeposit: number
  entryValue: number
  allowMultiples: boolean
  network: string
  address: string
  prizePoolPercent: number
}

export interface RoundOverview {
  roundId: string
  status: string
  index: number
  prizePool: number
  totalEntries: number
  participantsCount: number
  startsAt: string
  endsAt: string
  countdownSeconds: number
  network: string
  address: string
  entryValue: number
  allowMultiples: boolean
  minDeposit: number
  lastWinner?: {
    roundIndex: number
    userId: string
    entriesAtWin: number
    payoutStatus: string
    declaredAt: string
  }
  currentWinner?: {
    userId: string
    entriesAtWin: number
    payoutStatus: string
    selectedAt: string
    selectedBy: "random" | "manual"
  }
  user?: {
    pendingTransactionId?: string | null
    pendingStatus?: "pending" | "rejected"
    pendingReason?: string | null
    approvedEntries?: number
    totalInvested?: number
  }
}

export interface GiftBoxParticipantSummary {
  userId: string
  email: string
  entries: number
  transactions: Array<{
    entryId: string
    transactionId: string
    amount: number
    entries: number
    txHash: string
    approvedAt: string
  }>
}

function mergeSettings(doc: any | null): GiftBoxSettings {
  const blindBox = doc?.blindBox ?? {}
  const envAddress = process.env.GIFTBOX_BEP20_ADDRESS
  return {
    roundDurationHours: Number(blindBox.roundDurationHours ?? DEFAULT_ROUND_DURATION_HOURS) || DEFAULT_ROUND_DURATION_HOURS,
    minDeposit: Number(blindBox.minDeposit ?? DEFAULT_MIN_DEPOSIT) || DEFAULT_MIN_DEPOSIT,
    entryValue: Number(blindBox.entryValue ?? DEFAULT_ENTRY_VALUE) || DEFAULT_ENTRY_VALUE,
    allowMultiples: Boolean(
      typeof blindBox.allowMultiples === "boolean" ? blindBox.allowMultiples : true,
    ),
    network: String(blindBox.network || DEFAULT_NETWORK),
    address: String(envAddress || blindBox.address || DEFAULT_ADDRESS),
    prizePoolPercent: Number(blindBox.prizePoolPercent ?? DEFAULT_PRIZE_POOL_PERCENT) || DEFAULT_PRIZE_POOL_PERCENT,
  }
}

export async function getGiftBoxSettings(): Promise<GiftBoxSettings> {
  await dbConnect()
  const settingsDoc = await Settings.findOne().lean()
  return mergeSettings(settingsDoc)
}

async function getNextRoundIndex(): Promise<number> {
  const latest = await BlindBoxRound.findOne().sort({ index: -1 }).select({ index: 1 }).lean()
  return (latest?.index ?? 0) + 1
}

export async function ensureCurrentRound() {
  await dbConnect()
  const now = new Date()
  let current = await BlindBoxRound.findOne({ status: { $in: ["open", "locked", "drawing"] } })
    .sort({ index: -1 })
    .exec()

  if (!current) {
    const settings = await getGiftBoxSettings()
    const index = await getNextRoundIndex()
    const endsAt = new Date(now.getTime() + settings.roundDurationHours * 60 * 60 * 1000)
    current = await BlindBoxRound.create({
      index,
      status: "open",
      startsAt: now,
      endsAt,
      entryValue: settings.entryValue,
      prizePoolPercent: settings.prizePoolPercent,
      minDeposit: settings.minDeposit,
      allowMultiples: settings.allowMultiples,
      network: settings.network,
      address: settings.address,
    })
  } else if (current.status === "open" && current.endsAt.getTime() <= now.getTime()) {
    current.status = "locked"
    current.lockedAt = current.lockedAt ?? now
    await current.save()
  }

  return current
}

function calculateEntries(amount: number, entryValue: number, allowMultiples: boolean): number {
  if (!allowMultiples) {
    return amount >= entryValue ? 1 : 0
  }
  return Math.floor(amount / entryValue)
}

export async function createGiftBoxDeposit(options: {
  userId: string
  amount: number
  network: string
  address: string
  txHash: string
  receiptUrl: string
}): Promise<Transaction> {
  const settings = await getGiftBoxSettings()
  const { userId, amount, network, address, txHash, receiptUrl } = options

  if (network !== settings.network) {
    throw new Error(`Only ${settings.network} deposits are supported.`)
  }

  if (address !== settings.address) {
    throw new Error("Deposit address mismatch.")
  }

  if (!Number.isFinite(amount) || amount < settings.minDeposit) {
    throw new Error(`Minimum deposit is $${settings.minDeposit.toFixed(2)}.`)
  }

  const entries = calculateEntries(amount, settings.entryValue, settings.allowMultiples)
  if (entries < 1) {
    throw new Error(`Minimum deposit is $${settings.entryValue.toFixed(2)}.`)
  }

  await dbConnect()

  const banned = await BlindBoxBan.findOne({ userId: new mongoose.Types.ObjectId(userId) }).lean()
  if (banned) {
    throw new Error("You are not eligible to participate in the lucky draw.")
  }

  const existingTx = await Transaction.findOne({ type: "giftBoxDeposit", txHash }).lean()
  if (existingTx) {
    throw new Error("This transaction hash has already been submitted.")
  }

  const transaction = await Transaction.create({
    userId: new mongoose.Types.ObjectId(userId),
    type: "giftBoxDeposit",
    amount,
    network,
    address,
    txHash,
    receiptUrl,
    meta: {
      network,
      address,
      transactionHash: txHash,
      receiptUrl,
      entries,
    },
    status: "pending",
  })

  return transaction
}

export async function getCurrentRoundOverview(userId?: string | null): Promise<RoundOverview> {
  const [round, settings] = await Promise.all([ensureCurrentRound(), getGiftBoxSettings()])

  const now = new Date()
  const countdownSeconds = Math.max(0, Math.floor((round.endsAt.getTime() - now.getTime()) / 1000))

  const overview: RoundOverview = {
    roundId: round._id.toString(),
    status: round.status,
    index: round.index,
    prizePool: round.prizePool,
    totalEntries: round.totalEntries,
    participantsCount: round.participantsCount,
    startsAt: round.startsAt.toISOString(),
    endsAt: round.endsAt.toISOString(),
    countdownSeconds,
    network: round.network || settings.network,
    address: round.address || settings.address,
    entryValue: round.entryValue || settings.entryValue,
    allowMultiples: round.allowMultiples ?? settings.allowMultiples,
    minDeposit: round.minDeposit || settings.minDeposit,
  }

  if (round.winner) {
    overview.currentWinner = {
      userId: round.winner.userId?.toString?.() ?? "",
      entriesAtWin: round.winner.entriesAtWin,
      payoutStatus: round.winner.payoutStatus,
      selectedAt: round.winner.selectedBy?.at?.toISOString?.() ?? new Date().toISOString(),
      selectedBy: round.winner.selectedBy?.type ?? "random",
    }
  }

  const previousWinner = await BlindBoxRound.findOne({ status: "closed", winner: { $exists: true, $ne: null } })
    .sort({ index: -1 })
    .select({ index: 1, winner: 1 })
    .lean()

  if (previousWinner?.winner) {
    overview.lastWinner = {
      roundIndex: previousWinner.index,
      userId: previousWinner.winner.userId?.toString?.() ?? "",
      entriesAtWin: previousWinner.winner.entriesAtWin,
      payoutStatus: previousWinner.winner.payoutStatus,
      declaredAt: previousWinner.winner.selectedBy?.at?.toISOString?.() ?? new Date().toISOString(),
    }
  }

  if (userId) {
    const userObjectId = new mongoose.Types.ObjectId(userId)
    const [pendingTransaction, approvedEntries] = await Promise.all([
      Transaction.findOne({ userId: userObjectId, type: "giftBoxDeposit", status: { $in: ["pending", "rejected"] } })
        .sort({ createdAt: -1 })
        .lean(),
      BlindBoxEntry.aggregate([
        { $match: { roundId: round._id, userId: userObjectId, voidedAt: { $exists: false } } },
        {
          $group: {
            _id: "$userId",
            entries: { $sum: "$entries" },
            totalAmount: { $sum: "$amount" },
          },
        },
      ]),
    ])

    const aggregation = approvedEntries?.[0]

    overview.user = {
      pendingTransactionId: pendingTransaction?._id?.toString?.() ?? null,
      pendingStatus: pendingTransaction?.status as "pending" | "rejected" | undefined,
      pendingReason: pendingTransaction?.reason ?? null,
      approvedEntries: aggregation?.entries ?? 0,
      totalInvested: aggregation?.totalAmount ?? 0,
    }
  }

  return overview
}

export async function approveGiftBoxDeposit(options: {
  transactionId: string
  adminId: string
  adminEmail: string
}): Promise<{ roundId: string; entries: number }> {
  await dbConnect()

  const transaction = await Transaction.findOne({
    _id: new mongoose.Types.ObjectId(options.transactionId),
    type: "giftBoxDeposit",
  })

  if (!transaction) {
    throw new Error("Transaction not found")
  }

  if (transaction.status !== "pending") {
    throw new Error("Only pending submissions can be approved")
  }

  const round = await ensureCurrentRound()

  if (round.status !== "open") {
    throw new Error("Current round is not accepting new entries")
  }

  const entries = calculateEntries(transaction.amount, round.entryValue, round.allowMultiples)
  if (entries < 1) {
    throw new Error("Deposit amount is below the minimum entry value")
  }

  transaction.status = "approved"
  transaction.meta = {
    ...(transaction.meta && typeof transaction.meta === "object" ? transaction.meta : {}),
    approvedAt: new Date().toISOString(),
    entries,
  }
  await transaction.save()

  const existingEntries = await BlindBoxEntry.countDocuments({
    roundId: round._id,
    userId: transaction.userId,
    voidedAt: { $exists: false },
  })
  await BlindBoxEntry.create({
    roundId: round._id,
    userId: transaction.userId,
    transactionId: transaction._id,
    amount: transaction.amount,
    entries,
    network: transaction.network || round.network,
    address: transaction.address || round.address,
    txHash: transaction.txHash ?? transaction.meta?.transactionHash,
    receiptUrl: transaction.receiptUrl || transaction.meta?.receiptUrl,
    approvedAt: new Date(),
  })

  const prizeIncrement = (entries * round.entryValue * round.prizePoolPercent) / 100

  round.totalEntries += entries
  round.prizePool += prizeIncrement
  round.participantsCount += existingEntries > 0 ? 0 : 1
  round.lastEntryAt = new Date()
  await round.save()

  await Log.create({
    level: "info",
    message: "Approved blind box deposit",
    meta: {
      transactionId: transaction._id.toString(),
      adminId: options.adminId,
      adminEmail: options.adminEmail,
      roundId: round._id.toString(),
      entries,
    },
  })

  return { roundId: round._id.toString(), entries }
}

export async function rejectGiftBoxDeposit(options: {
  transactionId: string
  adminId: string
  adminEmail: string
  reason?: string
}): Promise<void> {
  await dbConnect()
  const transaction = await Transaction.findOne({
    _id: new mongoose.Types.ObjectId(options.transactionId),
    type: "giftBoxDeposit",
  })

  if (!transaction) {
    throw new Error("Transaction not found")
  }

  if (transaction.status !== "pending") {
    throw new Error("Only pending submissions can be rejected")
  }

  transaction.status = "rejected"
  transaction.reason = options.reason ?? ""
  transaction.meta = {
    ...(transaction.meta && typeof transaction.meta === "object" ? transaction.meta : {}),
    rejectionReason: options.reason ?? "",
  }
  await transaction.save()

  await Log.create({
    level: "warn",
    message: "Rejected blind box deposit",
    meta: {
      transactionId: transaction._id.toString(),
      adminId: options.adminId,
      adminEmail: options.adminEmail,
      reason: options.reason ?? null,
    },
  })
}

export async function listRoundParticipants(roundId: string): Promise<GiftBoxParticipantSummary[]> {
  await dbConnect()
  const objectId = new mongoose.Types.ObjectId(roundId)

  const aggregation = await BlindBoxEntry.aggregate([
    { $match: { roundId: objectId, voidedAt: { $exists: false } } },
    {
      $group: {
        _id: "$userId",
        entries: { $sum: "$entries" },
        transactions: {
          $push: {
            entryId: "$_id",
            transactionId: "$transactionId",
            amount: "$amount",
            entries: "$entries",
            txHash: "$txHash",
            approvedAt: "$approvedAt",
          },
        },
      },
    },
  ])

  const userIds = aggregation.map((item) => item._id)
  const users = await User.find({ _id: { $in: userIds } })
    .select({ email: 1 })
    .lean()

  const map = new Map(users.map((user) => [user._id.toString(), user]))

  return aggregation.map((item) => ({
    userId: item._id.toString(),
    email: map.get(item._id.toString())?.email ?? "",
    entries: item.entries,
    transactions: item.transactions.map((transaction: any) => ({
      entryId: transaction.entryId?.toString?.() ?? "",
      transactionId: transaction.transactionId?.toString?.() ?? "",
      amount: transaction.amount,
      entries: transaction.entries,
      txHash: transaction.txHash,
      approvedAt: transaction.approvedAt instanceof Date
        ? transaction.approvedAt.toISOString()
        : new Date(transaction.approvedAt).toISOString(),
    })),
  }))
}

async function assertAdmin(adminId: string) {
  await dbConnect()
  const admin = await User.findById(adminId).select({ email: 1, role: 1 }).lean()
  if (!admin || admin.role !== "admin") {
    throw new Error("Admin access required")
  }
  return admin
}

export async function updateRoundStatus(options: {
  adminId: string
  action: "open" | "lock" | "close"
}): Promise<RoundOverview> {
  const admin = await assertAdmin(options.adminId)
  await dbConnect()
  const activeRound = await BlindBoxRound.findOne({ status: { $in: ["open", "locked", "drawing"] } })
    .sort({ index: -1 })
    .exec()
  const now = new Date()

  if (options.action === "lock") {
    if (!activeRound) {
      throw new Error("No active round to lock")
    }
    if (activeRound.status !== "open") {
      throw new Error("Only open rounds can be locked")
    }
    activeRound.status = "locked"
    activeRound.lockedAt = now
  } else if (options.action === "close") {
    if (!activeRound) {
      throw new Error("No active round to close")
    }
    if (activeRound.status === "closed") {
      throw new Error("Round already closed")
    }
    if (!activeRound.winner) {
      throw new Error("Select a winner before closing the round")
    }
    activeRound.status = "closed"
    activeRound.closedAt = now
  } else if (options.action === "open") {
    if (activeRound && activeRound.status !== "closed") {
      throw new Error("Current round must be closed before opening a new one")
    }
    const settings = await getGiftBoxSettings()
    const index = await getNextRoundIndex()
    const startsAt = now
    const endsAt = new Date(startsAt.getTime() + settings.roundDurationHours * 60 * 60 * 1000)
    const newRound = await BlindBoxRound.create({
      index,
      status: "open",
      startsAt,
      endsAt,
      entryValue: settings.entryValue,
      prizePoolPercent: settings.prizePoolPercent,
      minDeposit: settings.minDeposit,
      allowMultiples: settings.allowMultiples,
      network: settings.network,
      address: settings.address,
    })

    await Log.create({
      level: "info",
      message: "Opened new blind box round",
      meta: { adminId: admin._id?.toString?.(), adminEmail: admin.email, roundId: newRound._id.toString() },
    })

    return getCurrentRoundOverview(null)
  }

  if (!activeRound) {
    throw new Error("No round found")
  }

  await activeRound.save()

  await Log.create({
    level: "info",
    message: "Updated blind box round status",
    meta: {
      adminId: admin._id?.toString?.(),
      adminEmail: admin.email,
      roundId: activeRound._id.toString(),
      status: activeRound.status,
    },
  })

  return getCurrentRoundOverview(null)
}

export async function randomizeWinner(options: {
  adminId: string
  roundId: string
}): Promise<void> {
  const admin = await assertAdmin(options.adminId)
  await dbConnect()

  const round = await BlindBoxRound.findById(options.roundId)
  if (!round) throw new Error("Round not found")
  if (round.status !== "locked" && round.status !== "drawing") {
    throw new Error("Round must be locked before drawing a winner")
  }

  const entries = await BlindBoxEntry.find({ roundId: round._id }).lean()
  if (!entries.length) {
    throw new Error("No entries to draw from")
  }

  const weighted: Array<{ userId: mongoose.Types.ObjectId; weight: number; txHash: string }> = []
  for (const entry of entries) {
    weighted.push({ userId: entry.userId, weight: entry.entries, txHash: entry.txHash })
  }

  const seedBase = `${round._id.toString()}-${Date.now()}-${entries.length}`
  const seed = crypto.createHash("sha256").update(seedBase).digest("hex")
  const rng = crypto.createHmac("sha256", seed).update(String(Math.random())).digest("hex")
  const totalWeight = weighted.reduce((acc, item) => acc + item.weight, 0)
  const numeric = parseInt(rng.slice(0, 12), 16)
  const target = numeric % totalWeight

  let cumulative = 0
  let winner: { userId: mongoose.Types.ObjectId; txHash: string; entries: number } | null = null
  for (const item of weighted) {
    cumulative += item.weight
    if (target < cumulative) {
      winner = { userId: item.userId, txHash: item.txHash, entries: item.weight }
      break
    }
  }

  if (!winner) {
    throw new Error("Failed to select a winner")
  }

  round.status = "drawing"
  round.winner = {
    userId: winner.userId,
    entriesAtWin: winner.entries,
    txHash: winner.txHash,
    selectedBy: {
      type: "random",
      adminId: new mongoose.Types.ObjectId(options.adminId),
      adminEmail: admin.email,
      at: new Date(),
    },
    payoutStatus: "pending",
  }
  round.rng = { seed, result: rng }
  await round.save()

  await Log.create({
    level: "info",
    message: "Randomly selected blind box winner",
    meta: { adminId: admin._id?.toString?.(), adminEmail: admin.email, roundId: round._id.toString(), seed },
  })
}

export async function manuallySetWinner(options: {
  adminId: string
  roundId: string
  userId: string
}): Promise<void> {
  const admin = await assertAdmin(options.adminId)
  await dbConnect()

  const round = await BlindBoxRound.findById(options.roundId)
  if (!round) throw new Error("Round not found")
  if (round.status !== "locked" && round.status !== "drawing") {
    throw new Error("Round must be locked before selecting a winner")
  }

  const userObjectId = new mongoose.Types.ObjectId(options.userId)
  const aggregate = await BlindBoxEntry.aggregate([
    { $match: { roundId: round._id, userId: userObjectId } },
    {
      $group: {
        _id: "$userId",
        entries: { $sum: "$entries" },
        txHash: { $first: "$txHash" },
      },
    },
  ])

  const summary = aggregate[0]
  if (!summary) {
    throw new Error("User has no entries in this round")
  }

  round.status = "drawing"
  round.winner = {
    userId: userObjectId,
    entriesAtWin: summary.entries,
    txHash: summary.txHash,
    selectedBy: {
      type: "manual",
      adminId: new mongoose.Types.ObjectId(options.adminId),
      adminEmail: admin.email,
      at: new Date(),
    },
    payoutStatus: "pending",
  }
  round.rng = undefined
  await round.save()

  await Log.create({
    level: "warn",
    message: "Manually selected blind box winner",
    meta: { adminId: admin._id?.toString?.(), adminEmail: admin.email, roundId: round._id.toString(), userId: options.userId },
  })
}

export async function markWinnerPaid(options: {
  adminId: string
  roundId: string
}): Promise<void> {
  const admin = await assertAdmin(options.adminId)
  await dbConnect()

  const round = await BlindBoxRound.findById(options.roundId)
  if (!round) throw new Error("Round not found")
  if (!round.winner) throw new Error("No winner selected")

  round.winner.payoutStatus = "paid"
  round.winner.paidAt = new Date()
  await round.save()

  await Log.create({
    level: "info",
    message: "Marked blind box prize as paid",
    meta: { adminId: admin._id?.toString?.(), adminEmail: admin.email, roundId: round._id.toString() },
  })
}

export async function voidEntry(options: {
  adminId: string
  entryId: string
  reason?: string
}): Promise<void> {
  const admin = await assertAdmin(options.adminId)
  await dbConnect()

  const entry = await BlindBoxEntry.findById(options.entryId)
  if (!entry) throw new Error("Entry not found")
  if (entry.voidedAt) throw new Error("Entry already voided")

  const round = await BlindBoxRound.findById(entry.roundId)
  if (!round) throw new Error("Round not found")
  if (round.status === "closed") {
    throw new Error("Cannot void entries for closed rounds")
  }

  entry.voidedAt = new Date()
  entry.voidReason = options.reason ?? ""
  await entry.save()

  round.totalEntries = Math.max(0, round.totalEntries - entry.entries)
  const decrement = (entry.entries * round.entryValue * round.prizePoolPercent) / 100
  round.prizePool = Math.max(0, round.prizePool - decrement)
  round.participantsCount = Math.max(0, round.participantsCount - 1)
  await round.save()

  await Log.create({
    level: "warn",
    message: "Voided blind box entry",
    meta: {
      adminId: admin._id?.toString?.(),
      adminEmail: admin.email,
      entryId: entry._id.toString(),
      roundId: round._id.toString(),
      reason: options.reason ?? null,
    },
  })
}

export async function banUserFromBlindBox(options: {
  adminId: string
  userId: string
  address?: string
  reason?: string
}): Promise<void> {
  const admin = await assertAdmin(options.adminId)
  await dbConnect()

  await BlindBoxBan.findOneAndUpdate(
    { userId: new mongoose.Types.ObjectId(options.userId) },
    {
      $set: {
        address: options.address,
        reason: options.reason ?? "",
        createdBy: admin._id,
        createdByEmail: admin.email,
      },
    },
    { upsert: true, new: true },
  )

  await Log.create({
    level: "warn",
    message: "Banned user from blind box",
    meta: { adminId: admin._id?.toString?.(), adminEmail: admin.email, userId: options.userId },
  })
}

export async function unbanUserFromBlindBox(options: {
  adminId: string
  userId: string
}): Promise<void> {
  const admin = await assertAdmin(options.adminId)
  await dbConnect()

  await BlindBoxBan.deleteOne({ userId: new mongoose.Types.ObjectId(options.userId) })

  await Log.create({
    level: "info",
    message: "Unbanned user from blind box",
    meta: { adminId: admin._id?.toString?.(), adminEmail: admin.email, userId: options.userId },
  })
}

export async function listBannedUsers(): Promise<Array<{ userId: string; address?: string; reason?: string }>> {
  await dbConnect()
  const bans = await BlindBoxBan.find().select({ userId: 1, address: 1, reason: 1 }).lean()
  return bans.map((ban) => ({
    userId: ban.userId?.toString?.() ?? "",
    address: ban.address ?? undefined,
    reason: ban.reason ?? undefined,
  }))
}

export function requireAuthenticatedUser(request: Request): string {
  const user = getUserFromRequest(request as any)
  if (!user) {
    throw new Error("Unauthorized")
  }
  return user.userId
}
