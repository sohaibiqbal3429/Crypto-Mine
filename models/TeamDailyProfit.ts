import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

type TeamDailyProfitClaim = {
  userId: mongoose.Types.ObjectId
  claimId?: mongoose.Types.ObjectId
  claimedAt: Date
}

export interface ITeamDailyProfit extends Document {
  memberId: mongoose.Types.ObjectId
  profitDate: Date
  profitAmount: number
  activeOnDate: boolean
  claimedBy: TeamDailyProfitClaim[]
  createdAt: Date
  updatedAt: Date
}

const TeamDailyProfitClaimSchema = new Schema<TeamDailyProfitClaim>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    claimId: { type: Schema.Types.ObjectId, ref: "TeamDailyClaim" },
    claimedAt: { type: Date, required: true },
  },
  { _id: false },
)

const TeamDailyProfitSchema = new Schema<ITeamDailyProfit>(
  {
    memberId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    profitDate: { type: Date, required: true, index: true },
    profitAmount: { type: Number, required: true },
    activeOnDate: { type: Boolean, default: false },
    claimedBy: { type: [TeamDailyProfitClaimSchema], default: [] },
  },
  {
    timestamps: true,
  },
)

TeamDailyProfitSchema.index({ memberId: 1, profitDate: 1 })
TeamDailyProfitSchema.index({ profitDate: 1 })
TeamDailyProfitSchema.index({ "claimedBy.userId": 1 })

export default createModelProxy<ITeamDailyProfit>("TeamDailyProfit", TeamDailyProfitSchema)
