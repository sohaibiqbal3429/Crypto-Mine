import mongoose from "mongoose"

import { createModelProxy } from "../lib/in-memory/model-factory"

const SettingsSchema = new mongoose.Schema(
  {
    dailyProfitPercent: {
      type: mongoose.Schema.Types.Decimal128,
      default: () => mongoose.Types.Decimal128.fromString("1.50"),
    },
    mining: {
      minPct: { type: Number, default: 1.5 },
      maxPct: { type: Number, default: 1.5 },
      roiCap: { type: Number, default: 3 },
    },
    gating: {
      minDeposit: { type: Number, default: 30 },
      minWithdraw: { type: Number, default: 30 },
      joinNeedsReferral: { type: Boolean, default: true },
      activeMinDeposit: { type: Number, default: 80 },
      capitalLockDays: { type: Number, default: 30 },
    },
    joiningBonus: {
      threshold: { type: Number, default: 0 },
      pct: { type: Number, default: 0 },
    },
    commission: {
            baseDirectPct: { type: Number, default: 15 },
      startAtDeposit: { type: Number, default: 50 },
      highTierPct: { type: Number, default: 5 },
      highTierStartAt: { type: Number, default: 100 },
    },
  },
  {
    timestamps: true,
  },
)

export default createModelProxy("Settings", SettingsSchema)
