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
  baseAmount: number          // base amount the percent is applied to
  percent: number             // stored as decimal fraction (e.g. 0.02 for 2%)
  payoutAmount: number        // rounded to 4dp upstream for precision
  sourceTxId: string          // idempotency key per event
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
    percent: { type: Number, required: true },     // stored as 0.02, not 2
    payoutAmount: { type: Number, required: true },
    sourceTxId: { type: String, required: true },
    status: { type: String, enum: ["PENDING", "CLAIMED"], default: "PENDING", index: true },
    claimedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

// Hot-path read indices
BonusPayoutSchema.index({ receiverUserId: 1, status: 1, createdAt: 1 }) // claim queue order
BonusPayoutSchema.index({ payerUserId: 1, type: 1, createdAt: -1 })     // reporting/exports

// ✅ Exact idempotency key as requested: (type, source_tx_id, receiver_user_id)
BonusPayoutSchema.index(
  { type: 1, sourceTxId: 1, receiverUserId: 1 },
  { unique: true, name: "uniq_type_source_receiver" },
)

export default createModelProxy<IBonusPayout>("BonusPayout", BonusPayoutSchema)
