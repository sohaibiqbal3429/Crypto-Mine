import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export interface ISettings extends Document {
  mining: {
    minPct: number
    maxPct: number
    roiCap: number
  }
  gating: {
    minDeposit: number
    minWithdraw: number
    joinNeedsReferral: boolean
    activeMinDeposit: number
    capitalLockDays: number
  }
  joiningBonus: {
    threshold: number
    pct: number
  }
  commission: {
    baseDirectPct: number
    startAtDeposit: number
    highTierPct: number
    highTierStartAt: number
  }
}

const SettingsSchema = new Schema<ISettings>(
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
  },
  {
    timestamps: true,
  },
)

export default createModelProxy<ISettings>("Settings", SettingsSchema)
