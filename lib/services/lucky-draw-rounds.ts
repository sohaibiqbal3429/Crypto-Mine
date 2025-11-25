import mongoose from "mongoose"

import dbConnect from "@/lib/mongodb"
import LuckyDrawRound, { type ILuckyDrawRound } from "@/models/LuckyDrawRound"
import LuckyDrawDeposit from "@/models/LuckyDrawDeposit"
import User from "@/models/User"
import type { LuckyDrawRound as LuckyDrawRoundView } from "@/lib/types/lucky-draw"

const ROUND_DURATION_MS = 72 * 60 * 60 * 1000
const DEFAULT_PRIZE_USD = 30

export class LuckyDrawRoundError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

function toObjectId(value: unknown): string | null {
  if (!value) return null
  if (typeof value === "string") return value
  if (value instanceof mongoose.Types.ObjectId) {
    return value.toString()
  }
  if (typeof value === "object") {
    const candidate = value as Record<string, unknown>
    if (typeof candidate.toString === "function") {
      const serialized = candidate.toString()
      if (serialized && serialized !== "[object Object]") {
        return serialized
      }
    }
    if (typeof (candidate as { toHexString?: () => string }).toHexString === "function") {
      const hex = (candidate as { toHexString: () => string }).toHexString()
      if (hex) return hex
    }
    if (candidate._id) {
      const nested = toObjectId(candidate._id)
      if (nested) {
        return nested
      }
    }
    try {
      return new mongoose.Types.ObjectId(candidate as any).toString()
    } catch (error) {
      return null
    }
  }
  return (value as { toString?: () => string }).toString?.() ?? null
}

function serializeRound(round: ILuckyDrawRound): LuckyDrawRoundView {
  return {
    id: toObjectId(round._id) ?? "",
    startAtUtc: round.startAtUtc.toISOString(),
    endAtUtc: round.endAtUtc.toISOString(),
    prizePoolUsd: round.prizePoolUsd,
    announcementAtUtc: round.announcementAtUtc.toISOString(),
    selectedWinner:
      round.selectedWinnerName && round.selectedAt
        ? {
            name: round.selectedWinnerName,
            selectedAt: round.selectedAt.toISOString(),
            depositId: toObjectId(round.selectedDepositId),
            userId: toObjectId(round.selectedUserId),
          }
        : null,
    lastWinner:
      round.lastWinnerName && round.lastWinnerAnnouncedAt
        ? {
            name: round.lastWinnerName,
            announcedAt: round.lastWinnerAnnouncedAt.toISOString(),
          }
        : null,
  }
}

async function ensureActiveRound(): Promise<ILuckyDrawRound> {
  await dbConnect()

  const existing = await LuckyDrawRound.find({ status: "ACTIVE" }).sort({ createdAt: -1 }).limit(1)
  if (existing.length > 0) {
    return existing[0] as ILuckyDrawRound
  }

  const latestResult = await LuckyDrawRound.find({}).sort({ roundNumber: -1 }).limit(1)
  const latest = latestResult[0] as ILuckyDrawRound | undefined
  const now = new Date()
  const announcementAt = new Date(now.getTime() + ROUND_DURATION_MS)

  const round = await LuckyDrawRound.create({
    roundNumber: (latest?.roundNumber ?? 0) + 1,
    status: "ACTIVE",
    prizePoolUsd: latest?.prizePoolUsd ?? DEFAULT_PRIZE_USD,
    startAtUtc: now,
    endAtUtc: announcementAt,
    announcementAtUtc: announcementAt,
    lastWinnerName:
      latest && latest.status !== "ACTIVE"
        ? latest.selectedWinnerName ?? latest.lastWinnerName ?? null
        : latest?.lastWinnerName ?? null,
    lastWinnerAnnouncedAt:
      latest && latest.status !== "ACTIVE"
        ? latest.announcementAtUtc ?? latest.lastWinnerAnnouncedAt ?? null
        : latest?.lastWinnerAnnouncedAt ?? null,
  })

  return round
}

export async function getActiveLuckyDrawRound(): Promise<LuckyDrawRoundView> {
  const round = await ensureActiveRound()
  return serializeRound(round)
}

export async function scheduleLuckyDrawWinner({
  adminId,
  depositId,
}: {
  adminId: string
  depositId: string
}): Promise<LuckyDrawRoundView> {
  await dbConnect()

  const admin = await User.findById(adminId)
  if (!admin || admin.role !== "admin") {
    throw new LuckyDrawRoundError("Unauthorized", 403)
  }

  const deposit = await LuckyDrawDeposit.findById(depositId)
  if (!deposit) {
    throw new LuckyDrawRoundError("Deposit not found", 404)
  }

  if (deposit.status !== "APPROVED") {
    throw new LuckyDrawRoundError("Only approved deposits can be scheduled as winners", 409)
  }

  const round = await ensureActiveRound()

  const participant = deposit.userId ? await User.findById(deposit.userId) : null
  const winnerName = participant?.name?.trim() || participant?.email?.trim() || "Participant"

  const selectionTime = new Date()
  const announcementAt = new Date(selectionTime.getTime() + ROUND_DURATION_MS)

  const depositObjectId =
    deposit._id instanceof mongoose.Types.ObjectId
      ? deposit._id
      : (() => {
          const idValue = toObjectId(deposit._id)
          return idValue ? (idValue as unknown as mongoose.Types.ObjectId) : null
        })()
  const depositIdString = toObjectId(deposit._id)
  const userIdString = toObjectId(deposit.userId)

  const updatePayload: Partial<ILuckyDrawRound> = {
    selectedDepositId: (depositIdString as unknown as mongoose.Types.ObjectId) ?? depositObjectId,
    selectedUserId:
      deposit.userId instanceof mongoose.Types.ObjectId
        ? deposit.userId
        : ((userIdString as unknown as mongoose.Types.ObjectId) ?? null),
    selectedWinnerName: winnerName,
    selectedAt: selectionTime,
    announcementAtUtc: announcementAt,
    endAtUtc: announcementAt,
  }

  await LuckyDrawRound.updateOne({ _id: round._id }, { $set: updatePayload })
  const refreshed = await LuckyDrawRound.find({ _id: round._id }).limit(1)
  const updatedRound = (refreshed[0] as ILuckyDrawRound | undefined) ?? round

  const view = serializeRound(updatedRound)
  if (view.selectedWinner) {
    view.selectedWinner.depositId = depositIdString
    view.selectedWinner.userId = userIdString
  }

  return view
}

export { serializeRound as serializeLuckyDrawRound }
