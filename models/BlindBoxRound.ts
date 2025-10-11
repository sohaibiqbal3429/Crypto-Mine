import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export type BlindBoxRoundStatus = "open" | "locked" | "drawing" | "closed"
export type BlindBoxPayoutStatus = "pending" | "paid"

interface WinnerInfo {
  userId: mongoose.Types.ObjectId
  entriesAtWin: number
  txHash?: string
  selectedBy: {
    type: "random" | "manual"
    adminId: mongoose.Types.ObjectId
    adminEmail: string
    at: Date
  }
  payoutStatus: BlindBoxPayoutStatus
  paidAt?: Date | null
}

interface RngInfo {
  seed: string
  result: string
}

export interface IBlindBoxRound extends Document {
  index: number
  status: BlindBoxRoundStatus
  startsAt: Date
  endsAt: Date
  lockedAt?: Date | null
  closedAt?: Date | null
  entryValue: number
  prizePoolPercent: number
  minDeposit: number
  allowMultiples: boolean
  network: string
  address: string
  totalEntries: number
  participantsCount: number
  prizePool: number
  lastEntryAt?: Date | null
  winner?: WinnerInfo | null
  rng?: RngInfo | null
  createdAt: Date
  updatedAt: Date
}

const WinnerSchema = new Schema<WinnerInfo>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    entriesAtWin: { type: Number, required: true },
    txHash: { type: String },
    selectedBy: {
      type: {
        type: String,
        enum: ["random", "manual"],
        required: true,
      },
      adminId: { type: Schema.Types.ObjectId, ref: "User", required: true },
      adminEmail: { type: String, required: true },
      at: { type: Date, required: true },
    },
    payoutStatus: { type: String, enum: ["pending", "paid"], default: "pending" },
    paidAt: { type: Date },
  },
  { _id: false },
)

const RngSchema = new Schema<RngInfo>(
  {
    seed: { type: String, required: true },
    result: { type: String, required: true },
  },
  { _id: false },
)

const BlindBoxRoundSchema = new Schema<IBlindBoxRound>(
  {
    index: { type: Number, required: true, unique: true },
    status: { type: String, enum: ["open", "locked", "drawing", "closed"], default: "open" },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    lockedAt: { type: Date },
    closedAt: { type: Date },
    entryValue: { type: Number, default: 10 },
    prizePoolPercent: { type: Number, default: 100 },
    minDeposit: { type: Number, default: 10 },
    allowMultiples: { type: Boolean, default: true },
    network: { type: String, default: "BEP20" },
    address: { type: String, default: "Bep20" },
    totalEntries: { type: Number, default: 0 },
    participantsCount: { type: Number, default: 0 },
    prizePool: { type: Number, default: 0 },
    lastEntryAt: { type: Date },
    winner: { type: WinnerSchema },
    rng: { type: RngSchema },
  },
  { timestamps: true },
)

BlindBoxRoundSchema.index({ status: 1, endsAt: 1 })
BlindBoxRoundSchema.index({ createdAt: -1 })

export default createModelProxy<IBlindBoxRound>("BlindBoxRound", BlindBoxRoundSchema)
