import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export type BonusPayoutType =
  | "DEPOSIT_BONUS_SELF"
  | "DEPOSIT_L1"
  | "DEPOSIT_L2"
  | "TEAM_EARN_L1"
  | "TEAM_EARN_L2"

export interface IBonusPayout extends Document {
  payerUserId: mongoose.Types.ObjectId
  receiverUserId: mongoose.Types.ObjectId
  type: BonusPayoutType
  baseAmount: number
  percent: number
  payoutAmount: number
  sourceTxId: string
  status: "PENDING" | "CLAIMED"
  createdAt: Date
  updatedAt: Date
  claimedAt?: Date | null
}

const BonusPayoutSchema = new Schema<IBonusPayout>(
  {
    payerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    receiverUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["DEPOSIT_BONUS_SELF", "DEPOSIT_L1", "DEPOSIT_L2", "TEAM_EARN_L1", "TEAM_EARN_L2"],
      required: true,
      index: true,
    },
    baseAmount: { type: Number, required: true },
    percent: { type: Number, required: true },
    payoutAmount: { type: Number, required: true },
    sourceTxId: { type: String, required: true },
    status: { type: String, enum: ["PENDING", "CLAIMED"], default: "PENDING", index: true },
    claimedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
)

BonusPayoutSchema.index({ receiverUserId: 1, status: 1, createdAt: -1 })
BonusPayoutSchema.index({ payerUserId: 1, type: 1, createdAt: -1 })
BonusPayoutSchema.index({ sourceTxId: 1, type: 1, receiverUserId: 1 }, { unique: true })

export default createModelProxy<IBonusPayout>("BonusPayout", BonusPayoutSchema)
