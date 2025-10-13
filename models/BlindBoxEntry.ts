import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export interface IBlindBoxEntry extends Document {
  roundId: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  transactionId: mongoose.Types.ObjectId
  amount: number
  entries: number
  network: string
  address: string
  txHash: string
  receiptUrl?: string
  approvedAt: Date
  voidedAt?: Date | null
  voidReason?: string
  createdAt: Date
  updatedAt: Date
}

const BlindBoxEntrySchema = new Schema<IBlindBoxEntry>(
  {
    roundId: { type: Schema.Types.ObjectId, ref: "BlindBoxRound", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    transactionId: { type: Schema.Types.ObjectId, ref: "Transaction", required: true, unique: true },
    amount: { type: Number, required: true },
    entries: { type: Number, required: true },
    network: { type: String, required: true },
    address: { type: String, required: true },
    txHash: { type: String, required: true },
    receiptUrl: { type: String },
    approvedAt: { type: Date, required: true },
    voidedAt: { type: Date },
    voidReason: { type: String },
  },
  { timestamps: true },
)

BlindBoxEntrySchema.index({ roundId: 1, userId: 1 })
BlindBoxEntrySchema.index({ userId: 1, createdAt: -1 })
BlindBoxEntrySchema.index({ txHash: 1 }, { unique: true })

export default createModelProxy<IBlindBoxEntry>("BlindBoxEntry", BlindBoxEntrySchema)
