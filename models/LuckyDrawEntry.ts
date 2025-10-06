import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export interface ILuckyDrawEntry extends Document {
  roundId: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  joinedAt: Date
  createdAt: Date
  updatedAt: Date
}

const LuckyDrawEntrySchema = new Schema<ILuckyDrawEntry>(
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

export default createModelProxy<ILuckyDrawEntry>("LuckyDrawEntry", LuckyDrawEntrySchema)
