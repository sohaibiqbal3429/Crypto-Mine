import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export interface IBlindBoxBan extends Document {
  userId: mongoose.Types.ObjectId
  address?: string
  reason?: string
  createdBy: mongoose.Types.ObjectId
  createdByEmail: string
  createdAt: Date
  updatedAt: Date
}

const BlindBoxBanSchema = new Schema<IBlindBoxBan>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    address: { type: String },
    reason: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdByEmail: { type: String, required: true },
  },
  { timestamps: true },
)

BlindBoxBanSchema.index({ createdAt: -1 })

export default createModelProxy<IBlindBoxBan>("BlindBoxBan", BlindBoxBanSchema)
