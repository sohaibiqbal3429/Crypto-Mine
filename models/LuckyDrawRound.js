import mongoose from "mongoose"

import { createModelProxy } from "../lib/in-memory/model-factory.js"

const { Schema } = mongoose

const LuckyDrawRoundSchema = new Schema(
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

export default createModelProxy("LuckyDrawRound", LuckyDrawRoundSchema)
