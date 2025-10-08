import mongoose from "mongoose"

import { createModelProxy } from "../lib/in-memory/model-factory"

const SettingsSchema = new mongoose.Schema(
  {
    mining: {
      minPct: { type: Number, default: 1.5 },
      maxPct: { type: Number, default: 5.0 },
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
      threshold: { type: Number, default: 100 },
      pct: { type: Number, default: 5 },
    },
    commission: {
      baseDirectPct: { type: Number, default: 7 },
      startAtDeposit: { type: Number, default: 50 },
      highTierPct: { type: Number, default: 5 },
      highTierStartAt: { type: Number, default: 100 },
    },
    giftBox: {
      ticketPrice: { type: Number, default: 10 },
      payoutPercentage: { type: Number, default: 90 },
      cycleHours: { type: Number, default: 72 },
      winnersCount: { type: Number, default: 1 },
      autoDrawEnabled: { type: Boolean, default: true },
      refundPercentage: { type: Number, default: 0 },
      depositAddress: { type: String, default: "TRhSCE8igyVmMuuRqukZEQDkn3MuEAdvfw" },
    },
  },
  {
    timestamps: true,
  },
)

export default createModelProxy("Settings", SettingsSchema)
