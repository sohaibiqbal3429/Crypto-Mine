import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export type GiftBoxParticipantStatus = "active" | "eliminated"

export interface IGiftBoxParticipant extends Document {
  userId: mongoose.Types.ObjectId
  cycleId: mongoose.Types.ObjectId
  depositId?: mongoose.Types.ObjectId | null
  hashedUserId: string
  status: GiftBoxParticipantStatus
  createdAt: Date
  updatedAt: Date
}

const GiftBoxParticipantSchema = new Schema<IGiftBoxParticipant>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    cycleId: { type: Schema.Types.ObjectId, ref: "GiftBoxCycle", required: true },
    depositId: { type: Schema.Types.ObjectId, ref: "GiftBoxDeposit", required: false, default: null },
    hashedUserId: { type: String, required: true },
    status: { type: String, enum: ["active", "eliminated"], default: "active" },
  },
  { timestamps: true },
)

GiftBoxParticipantSchema.index({ cycleId: 1, userId: 1 }, { unique: true })
GiftBoxParticipantSchema.index({ cycleId: 1, status: 1 })

export default createModelProxy<IGiftBoxParticipant>("GiftBoxParticipant", GiftBoxParticipantSchema)
