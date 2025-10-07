import mongoose from "mongoose"

import { createModelProxy } from "../lib/in-memory/model-factory"

const { Schema } = mongoose

const LuckyDrawEntrySchema = new Schema(
  {
    roundId: { type: Schema.Types.ObjectId, ref: "LuckyDrawRound", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    joinedAt: { type: Date, default: () => new Date() },
  },
  {
    timestamps: true,
  },
)

LuckyDrawEntrySchema.index({ roundId: 1, userId: 1 }, { unique: true })
LuckyDrawEntrySchema.index({ roundId: 1, joinedAt: -1 })

export default createModelProxy("LuckyDrawEntry", LuckyDrawEntrySchema)
