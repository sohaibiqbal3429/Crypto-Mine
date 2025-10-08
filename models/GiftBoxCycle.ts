import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export type GiftBoxCycleStatus = "open" | "completed"

export interface IGiftBoxWinnerSnapshot {
  userId: mongoose.Types.ObjectId
  name: string
  email?: string | null
  referralCode?: string | null
  creditedAt?: Date | null
}

export interface IGiftBoxCycle extends Document {
  status: GiftBoxCycleStatus
  startTime: Date
  endTime: Date
  ticketPrice: number
  payoutPercentage: number
  totalParticipants: number
  winnerUserId?: mongoose.Types.ObjectId | null
  winnerSnapshot?: IGiftBoxWinnerSnapshot | null
  payoutTxId?: mongoose.Types.ObjectId | null
  fairnessProof?: {
    serverSeed: string
    clientSeed: string
    nonce: number
    hash: string
    winnerIndex: number
  } | null
  createdAt: Date
  updatedAt: Date
}

const GiftBoxWinnerSnapshotSchema = new Schema<IGiftBoxWinnerSnapshot>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    email: { type: String },
    referralCode: { type: String },
    creditedAt: { type: Date },
  },
  { _id: false },
)

const GiftBoxCycleSchema = new Schema<IGiftBoxCycle>(
  {
    status: { type: String, enum: ["open", "completed"], default: "open" },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    ticketPrice: { type: Number, required: true },
    payoutPercentage: { type: Number, required: true },
    totalParticipants: { type: Number, default: 0 },
    winnerUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    winnerSnapshot: { type: GiftBoxWinnerSnapshotSchema, default: null },
    payoutTxId: { type: Schema.Types.ObjectId, ref: "Transaction", default: null },
    fairnessProof: {
      type: new Schema(
        {
          serverSeed: { type: String, required: true },
          clientSeed: { type: String, required: true },
          nonce: { type: Number, required: true },
          hash: { type: String, required: true },
          winnerIndex: { type: Number, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
  },
  { timestamps: true },
)

GiftBoxCycleSchema.index({ status: 1, endTime: 1 })
GiftBoxCycleSchema.index({ createdAt: -1 })

export default createModelProxy<IGiftBoxCycle>("GiftBoxCycle", GiftBoxCycleSchema)
