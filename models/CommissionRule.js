import mongoose from "mongoose"

import { createModelProxy } from "../lib/in-memory/model-factory"

const CommissionRuleSchema = new mongoose.Schema(
  {
    level: { type: Number, required: true, unique: true },
    directPct: { type: Number, required: true },
    teamDailyPct: { type: Number, default: 0 },
    teamRewardPct: { type: Number, default: 0 },
    teamOverrides: {
      type: [
        {
          team: { type: String, enum: ["A", "B", "C", "D"], required: true },
          depth: { type: Number, required: true },
          pct: { type: Number, required: true },
          kind: {
            type: String,
            enum: ["daily_override", "team_commission", "team_reward"],
            default: "team_commission",
          },
          payout: { type: String, enum: ["commission", "reward"], required: true },
          appliesTo: { type: String, enum: ["profit"], default: "profit" },
        },
      ],
      default: [],
    },
    monthlyBonuses: {
      type: [
        {
          threshold: { type: Number, required: true },
          amount: { type: Number, required: true },
          type: { type: String, enum: ["bonus", "salary"], required: true },
          label: { type: String, required: true },
        },
      ],
      default: [],
    },
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

CommissionRuleSchema.index({ level: 1 })

export default createModelProxy("CommissionRule", CommissionRuleSchema)
