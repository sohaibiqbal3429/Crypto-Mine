import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export type GiftBoxDepositStatus = "pending" | "approved" | "rejected"

export interface IGiftBoxDeposit extends Document {
  userId: mongoose.Types.ObjectId
  amount: number
  network: string
  address: string
  txId: string
  status: GiftBoxDepositStatus
  type: "giftbox"
  cycleId?: mongoose.Types.ObjectId | null
  createdAt: Date
  updatedAt: Date
  reviewedAt?: Date | null
  reviewedBy?: mongoose.Types.ObjectId | null
  rejectionReason?: string | null
}

const GiftBoxDepositSchema = new Schema<IGiftBoxDeposit>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    network: { type: String, required: true },
    address: { type: String, required: true },
    txId: { type: String, required: true, unique: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    type: { type: String, enum: ["giftbox"], default: "giftbox" },
    cycleId: { type: Schema.Types.ObjectId, ref: "GiftBoxCycle", default: null },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    rejectionReason: { type: String, default: null },
  },
  { timestamps: true },
)

GiftBoxDepositSchema.index({ status: 1, createdAt: -1 })
GiftBoxDepositSchema.index({ userId: 1, createdAt: -1 })
GiftBoxDepositSchema.index({ cycleId: 1, status: 1 })

export default createModelProxy<IGiftBoxDeposit>("GiftBoxDeposit", GiftBoxDepositSchema)
