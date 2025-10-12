import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export type LedgerEntryType = "LUCKY_DRAW_DEPOSIT"

export interface ILedgerEntry extends Document {
  userId: mongoose.Types.ObjectId
  type: LedgerEntryType
  amount: number
  refId?: mongoose.Types.ObjectId | null
  meta?: Record<string, unknown> | null
  createdAt: Date
}

const LedgerEntrySchema = new Schema<ILedgerEntry>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["LUCKY_DRAW_DEPOSIT"], required: true },
    amount: { type: Number, required: true },
    refId: { type: Schema.Types.ObjectId },
    meta: { type: Schema.Types.Mixed, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
)

LedgerEntrySchema.index({ userId: 1, createdAt: -1 })
LedgerEntrySchema.index({ type: 1, createdAt: -1 })
LedgerEntrySchema.index({ type: 1, refId: 1 }, { unique: true, sparse: true })

export default createModelProxy<ILedgerEntry>("LedgerEntry", LedgerEntrySchema)
