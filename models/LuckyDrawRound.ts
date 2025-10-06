import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export type LuckyDrawStatus = "open" | "closed" | "completed"

export interface ILuckyDrawWinnerSnapshot {
  userId: mongoose.Types.ObjectId
  name: string
  referralCode: string
  email?: string | null
  creditedAt?: Date | null
}

export interface ILuckyDrawRound extends Document {
  status: LuckyDrawStatus
  startsAt: Date
  endsAt: Date
  entryFee: number
  prize: number
  totalEntries: number
  winnerUserId?: mongoose.Types.ObjectId | null
  payoutTxId?: mongoose.Types.ObjectId | null
  winnerSnapshot?: ILuckyDrawWinnerSnapshot | null
  closedAt?: Date | null
  completedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

const LuckyDrawRoundSchema = new Schema<ILuckyDrawRound>(
  {
    status: { type: String, enum: ["open", "closed", "completed"], default: "open" },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    entryFee: { type: Number, default: 10 },
    prize: { type: Number, default: 30 },
    totalEntries: { type: Number, default: 0 },
    winnerUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    payoutTxId: { type: Schema.Types.ObjectId, ref: "Transaction", default: null },
    winnerSnapshot: {
      userId: { type: Schema.Types.ObjectId, ref: "User" },
      name: { type: String },
      referralCode: { type: String },
      email: { type: String },
      creditedAt: { type: Date },
    },
    closedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
)

LuckyDrawRoundSchema.index({ status: 1, endsAt: 1 })
LuckyDrawRoundSchema.index({ createdAt: -1 })

export default createModelProxy<ILuckyDrawRound>("LuckyDrawRound", LuckyDrawRoundSchema)
