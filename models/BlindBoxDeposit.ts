import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export type BlindBoxDepositStatus = "pending" | "approved" | "rejected"

export interface IBlindBoxDeposit extends Document {
  userId: mongoose.Types.ObjectId
  amount: number
  network: string
  address: string
  txId: string
  status: BlindBoxDepositStatus
  type: "blindbox"
  createdAt: Date
  updatedAt: Date
  reviewedAt?: Date | null
  reviewedBy?: mongoose.Types.ObjectId | null
  rejectionReason?: string | null
}

const BlindBoxDepositSchema = new Schema<IBlindBoxDeposit>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    network: { type: String, required: true },
    address: { type: String, required: true },
    txId: { type: String, required: true, unique: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    type: { type: String, enum: ["blindbox"], default: "blindbox" },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    rejectionReason: { type: String, default: null },
  },
  { timestamps: true },
)

BlindBoxDepositSchema.index({ status: 1, createdAt: -1 })
BlindBoxDepositSchema.index({ userId: 1, createdAt: -1 })

export default createModelProxy<IBlindBoxDeposit>("BlindBoxDeposit", BlindBoxDepositSchema)
