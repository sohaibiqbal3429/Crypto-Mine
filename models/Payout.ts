import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export type PayoutType = "direct_deposit" | "team_deposit" | "team_profit" | "monthly_bonus"

export interface IPayout extends Document {
  userId: mongoose.Types.ObjectId
  type: PayoutType
  sourceId?: mongoose.Types.ObjectId | null
  amount: number
  status: "pending" | "processing" | "completed" | "failed"
  date: Date
  uniqueKey: string
  meta?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

const PayoutSchema = new Schema<IPayout>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["direct_deposit", "team_deposit", "team_profit", "monthly_bonus"],
      required: true,
      index: true,
    },
    sourceId: { type: Schema.Types.ObjectId },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },
    date: { type: Date, required: true, index: true },
    uniqueKey: { type: String, required: true, unique: true },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
)

PayoutSchema.index({ userId: 1, createdAt: -1 })
PayoutSchema.index({ status: 1, createdAt: -1 })
PayoutSchema.index({ type: 1, date: -1 })

export default createModelProxy<IPayout>("Payout", PayoutSchema)
