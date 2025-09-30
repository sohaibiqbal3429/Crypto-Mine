import mongoose from "mongoose"

const CommissionRuleSchema = new mongoose.Schema(
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

CommissionRuleSchema.index({ level: 1 })

export default mongoose.models.CommissionRule || mongoose.model("CommissionRule", CommissionRuleSchema)
