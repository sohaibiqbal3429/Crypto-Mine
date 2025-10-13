import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export interface ITransaction extends Document {
  userId: mongoose.Types.ObjectId
  type:
    | "deposit"
    | "withdraw"
    | "earn"
    | "stake"
    | "stakeInterest"
    | "commission"
    | "bonus"
    | "adjust"
    | "teamReward"
    | "giftBoxDeposit"
  amount: number
  meta: any
  userEmail?: string
  status?: "pending" | "approved" | "rejected"
  network?: string
  address?: string
  txHash?: string
  receiptUrl?: string
  reason?: string
  createdAt: Date
}

const TransactionSchema = new Schema<ITransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: [
        "deposit",
        "withdraw",
        "earn",
        "stake", 
        "stakeInterest",
        "commission",
        "bonus",
        "adjust",
        "teamReward",
        "giftBoxDeposit",
      ],
      required: true,
    },
    amount: { type: Number, required: true },
    userEmail: { type: String, index: true },
    meta: { type: Schema.Types.Mixed },
    network: { type: String },
    address: { type: String },
    txHash: { type: String },
    receiptUrl: { type: String },
    reason: { type: String },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: function (this: { type: ITransaction["type"] }) {
        return ["deposit", "withdraw", "giftBoxDeposit"].includes(this.type) ? "pending" : "approved"
      },
    },
  },
  {
    timestamps: true,
  },
)

TransactionSchema.index({ userId: 1, createdAt: -1 })
TransactionSchema.index({ status: 1, createdAt: -1 })
TransactionSchema.index({ userEmail: 1 })
TransactionSchema.index({ createdAt: -1, _id: 1 })
TransactionSchema.index({ type: 1, status: 1 })
TransactionSchema.index(
  { type: 1, txHash: 1 },
  {
    unique: true,
    partialFilterExpression: { txHash: { $type: "string" } },
  },
)

export default createModelProxy<ITransaction>("Transaction", TransactionSchema)
