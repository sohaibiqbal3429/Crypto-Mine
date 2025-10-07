import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export type BlindBoxParticipantStatus = "active" | "eliminated"

export interface IBlindBoxParticipant extends Document {
  userId: mongoose.Types.ObjectId
  roundId: mongoose.Types.ObjectId
  depositId?: mongoose.Types.ObjectId | null
  hashedUserId: string
  status: BlindBoxParticipantStatus
  createdAt: Date
  updatedAt: Date
}

const BlindBoxParticipantSchema = new Schema<IBlindBoxParticipant>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    roundId: { type: Schema.Types.ObjectId, ref: "BlindBoxRound", required: true },
    depositId: { type: Schema.Types.ObjectId, ref: "BlindBoxDeposit", required: false, default: null },
    hashedUserId: { type: String, required: true },
    status: { type: String, enum: ["active", "eliminated"], default: "active" },
  },
  { timestamps: true },
)

BlindBoxParticipantSchema.index({ roundId: 1, userId: 1 }, { unique: true })
BlindBoxParticipantSchema.index({ roundId: 1, status: 1 })

export default createModelProxy<IBlindBoxParticipant>("BlindBoxParticipant", BlindBoxParticipantSchema)
