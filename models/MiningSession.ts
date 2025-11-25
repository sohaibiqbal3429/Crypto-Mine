import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export interface IMiningSession extends Document {
  userId: mongoose.Types.ObjectId
  lastClickAt: Date
  nextEligibleAt: Date
  earnedInCycle: number
}

const MiningSessionSchema = new Schema<IMiningSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    lastClickAt: { type: Date },
    nextEligibleAt: { type: Date },
    earnedInCycle: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  },
)

MiningSessionSchema.index({ userId: 1 })
MiningSessionSchema.index({ nextEligibleAt: 1 })

export default createModelProxy<IMiningSession>("MiningSession", MiningSessionSchema)
