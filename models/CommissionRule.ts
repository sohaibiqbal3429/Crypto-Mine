import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export interface ICommissionRule extends Document {
  level: number
  directPct: number
  teamDailyPct: number
  teamRewardPct: number
  monthlyTargets: {
    directSale: number
    bonus: number
    salary?: number
  }
  activeMin: number
}

const CommissionRuleSchema = new Schema<ICommissionRule>(
  {
    level: { type: Number, required: true, unique: true },
    directPct: { type: Number, required: true },
    teamDailyPct: { type: Number, default: 0 },
    teamRewardPct: { type: Number, default: 0 },
    monthlyTargets: {
      directSale: { type: Number, default: 0 },
      bonus: { type: Number, default: 0 },
      salary: { type: Number },
    },
    activeMin: { type: Number, required: true },
  },
  {
    timestamps: true,
  },
)

export default createModelProxy<ICommissionRule>("CommissionRule", CommissionRuleSchema)
