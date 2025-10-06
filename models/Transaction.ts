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
    | "luckyDrawEntry"
    | "luckyDrawReward"
  amount: number
  meta: any
  status?: "pending" | "approved" | "rejected"
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
        "luckyDrawEntry",
        "luckyDrawReward",
      ],
      required: true,
    },
    amount: { type: Number, required: true },
    meta: { type: Schema.Types.Mixed },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: function (this: { type: ITransaction["type"] }) {
        return ["deposit", "withdraw"].includes(this.type) ? "pending" : "approved"
      },
    },
  },
  {
    timestamps: true,
  },
)

TransactionSchema.index({ userId: 1, createdAt: -1 })
TransactionSchema.index({ type: 1, status: 1 })

export default createModelProxy<ITransaction>("Transaction", TransactionSchema)
