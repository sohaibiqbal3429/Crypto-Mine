import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

type TeamCode = "A" | "B" | "C" | "D"

export interface ITeamDailyClaim extends Document {
  userId: mongoose.Types.ObjectId
  amount: number
  level: number
  rate: number
  coveredTeams: TeamCode[]
  windowStart?: Date | null
  windowEnd: Date
  dgpIds: mongoose.Types.ObjectId[]
  totalDgp: number
  dgpCount: number
  createdAt: Date
  updatedAt: Date
}

const TeamDailyClaimSchema = new Schema<ITeamDailyClaim>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true },
    level: { type: Number, required: true },
    rate: { type: Number, required: true },
    coveredTeams: [{ type: String, enum: ["A", "B", "C", "D"], required: true }],
    windowStart: { type: Date },
    windowEnd: { type: Date, required: true },
    dgpIds: [{ type: Schema.Types.ObjectId, ref: "TeamDailyProfit" }],
    totalDgp: { type: Number, required: true },
    dgpCount: { type: Number, required: true },
  },
  {
    timestamps: true,
  },
)

TeamDailyClaimSchema.index({ userId: 1, windowEnd: -1 })
TeamDailyClaimSchema.index({ createdAt: -1 })

export default createModelProxy<ITeamDailyClaim>("TeamDailyClaim", TeamDailyClaimSchema)
