import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export type LuckyDrawDepositStatus = "PENDING" | "APPROVED" | "REJECTED"

export interface ILuckyDrawReceiptMeta {
  url: string
  originalName?: string
  mimeType?: string
  size?: number
  uploadedAt?: string
  checksum?: string
}

export interface ILuckyDrawDeposit extends Document {
  userId: mongoose.Types.ObjectId
  amount: number
  transactionHash: string
  transactionReceiptUrl?: string
  receipt?: ILuckyDrawReceiptMeta | null
  status: LuckyDrawDepositStatus
  adminNote?: string | null
  createdAt: Date
  updatedAt: Date
  decisionAt?: Date | null
  decidedBy?: mongoose.Types.ObjectId | null
}

const LuckyDrawReceiptSchema = new Schema<ILuckyDrawReceiptMeta>(
  {
    url: { type: String, required: true },
    originalName: { type: String },
    mimeType: { type: String },
    size: { type: Number },
    uploadedAt: { type: String },
    checksum: { type: String },
  },
  { _id: false },
)

const LuckyDrawDepositSchema = new Schema<ILuckyDrawDeposit>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true, default: 10 },
    transactionHash: { type: String, required: true },
    transactionReceiptUrl: { type: String },
    receipt: { type: LuckyDrawReceiptSchema, default: null },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
    adminNote: { type: String, default: null },
    decisionAt: { type: Date, default: null },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: true,
  },
)

LuckyDrawDepositSchema.index({ userId: 1, createdAt: -1 })
LuckyDrawDepositSchema.index({ status: 1, createdAt: -1 })
LuckyDrawDepositSchema.index({ transactionHash: 1 }, { unique: true })
LuckyDrawDepositSchema.index({ decidedBy: 1, decisionAt: -1 })

export default createModelProxy<ILuckyDrawDeposit>("LuckyDrawDeposit", LuckyDrawDepositSchema)
