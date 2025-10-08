import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export interface IPayout extends Document {
  userId: mongoose.Types.ObjectId
  amount: number
  status: "pending" | "processing" | "completed" | "failed"
  meta?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

const PayoutSchema = new Schema<IPayout>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
)

PayoutSchema.index({ userId: 1, createdAt: -1 })
PayoutSchema.index({ status: 1, createdAt: -1 })

export default createModelProxy<IPayout>("Payout", PayoutSchema)
