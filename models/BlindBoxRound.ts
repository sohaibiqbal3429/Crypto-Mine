import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export type BlindBoxRoundStatus = "open" | "completed"

export interface IBlindBoxWinnerSnapshot {
  userId: mongoose.Types.ObjectId
  name: string
  email?: string | null
  referralCode?: string | null
  creditedAt?: Date | null
}

export interface IBlindBoxRound extends Document {
  status: BlindBoxRoundStatus
  startTime: Date
  endTime: Date
  depositAmount: number
  rewardAmount: number
  totalParticipants: number
  winnerUserId?: mongoose.Types.ObjectId | null
  winnerSnapshot?: IBlindBoxWinnerSnapshot | null
  payoutTxId?: mongoose.Types.ObjectId | null
  createdAt: Date
  updatedAt: Date
}

const BlindBoxWinnerSnapshotSchema = new Schema<IBlindBoxWinnerSnapshot>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    email: { type: String },
    referralCode: { type: String },
    creditedAt: { type: Date },
  },
  { _id: false },
)

const BlindBoxRoundSchema = new Schema<IBlindBoxRound>(
  {
    status: { type: String, enum: ["open", "completed"], default: "open" },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    depositAmount: { type: Number, required: true },
    rewardAmount: { type: Number, required: true },
    totalParticipants: { type: Number, default: 0 },
    winnerUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    winnerSnapshot: { type: BlindBoxWinnerSnapshotSchema, default: null },
    payoutTxId: { type: Schema.Types.ObjectId, ref: "Transaction", default: null },
  },
  { timestamps: true },
)

BlindBoxRoundSchema.index({ status: 1, endTime: 1 })
BlindBoxRoundSchema.index({ createdAt: -1 })

export default createModelProxy<IBlindBoxRound>("BlindBoxRound", BlindBoxRoundSchema)
