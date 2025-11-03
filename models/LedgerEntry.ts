import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export type LedgerEntryType =
  | "LUCKY_DRAW_DEPOSIT"
  | "deposit_commission"
  | "daily_team_commission"

export interface ILedgerEntry extends Document {
  userId: mongoose.Types.ObjectId
  beneficiaryId?: mongoose.Types.ObjectId | null
  sourceUserId?: mongoose.Types.ObjectId | null
  type: LedgerEntryType
  amount: number
  rate?: number | null
  refId?: mongoose.Types.ObjectId | null
  meta?: Record<string, unknown> | null
  createdAt: Date
}

const LedgerEntrySchema = new Schema<ILedgerEntry>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    beneficiaryId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    sourceUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    type: {
      type: String,
      enum: ["LUCKY_DRAW_DEPOSIT", "deposit_commission", "daily_team_commission"],
      required: true,
    },
    amount: { type: Number, required: true },
    rate: { type: Number, default: null },
    refId: { type: Schema.Types.ObjectId },
    meta: { type: Schema.Types.Mixed, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
)

LedgerEntrySchema.index({ userId: 1, createdAt: -1 })
LedgerEntrySchema.index({ beneficiaryId: 1, createdAt: -1 })
LedgerEntrySchema.index({ type: 1, createdAt: -1 })
LedgerEntrySchema.index({ type: 1, refId: 1 }, { unique: true, sparse: true })
LedgerEntrySchema.index({ type: 1, "meta.uniqueKey": 1 }, { unique: true, sparse: true })
LedgerEntrySchema.index(
  { beneficiaryId: 1, type: 1, "meta.date": 1 },
  { unique: true, sparse: true },
)

export default createModelProxy<ILedgerEntry>("LedgerEntry", LedgerEntrySchema)
