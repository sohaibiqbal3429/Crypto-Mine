import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export interface ILevelHistory extends Document {
  userId: mongoose.Types.ObjectId
  level: number
  achievedAt: Date
  createdAt: Date
  updatedAt: Date
}

const LevelHistorySchema = new Schema<ILevelHistory>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    level: { type: Number, required: true },
    achievedAt: { type: Date, required: true },
  },
  {
    timestamps: true,
  },
)

LevelHistorySchema.index({ userId: 1, level: 1 }, { unique: true })

export default createModelProxy<ILevelHistory>("LevelHistory", LevelHistorySchema)
