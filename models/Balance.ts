import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export interface ILockedCapitalLot {
  amount: number
  lockStart: Date
  lockEnd: Date
  released: boolean
  releasedAt?: Date
  sourceTransactionId?: mongoose.Types.ObjectId
}

export interface IBalance extends Document {
  userId: mongoose.Types.ObjectId
  current: number
  totalBalance: number
  totalEarning: number
  lockedCapital: number
  lockedCapitalLots: ILockedCapitalLot[]
  staked: number
  pendingWithdraw: number
  teamRewardsAvailable: number
  teamRewardsClaimed: number
  teamRewardsLastClaimedAt?: Date
  luckyDrawCredits: number
  updatedAt: Date
}

const LockedCapitalLotSchema = new Schema<ILockedCapitalLot>(
  {
    amount: { type: Number, required: true },
    lockStart: { type: Date, required: true },
    lockEnd: { type: Date, required: true },
    released: { type: Boolean, default: false },
    releasedAt: { type: Date },
    sourceTransactionId: { type: Schema.Types.ObjectId, ref: "Transaction" },
  },
  { _id: false },
)

const BalanceSchema = new Schema<IBalance>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    current: { type: Number, default: 0 },
    totalBalance: { type: Number, default: 0 },
    totalEarning: { type: Number, default: 0 },
    lockedCapital: { type: Number, default: 0 },
    lockedCapitalLots: { type: [LockedCapitalLotSchema], default: [] },
    staked: { type: Number, default: 0 },
    pendingWithdraw: { type: Number, default: 0 },
    teamRewardsAvailable: { type: Number, default: 0 },
    teamRewardsClaimed: { type: Number, default: 0 },
    teamRewardsLastClaimedAt: { type: Date },
    luckyDrawCredits: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  },
)

BalanceSchema.index({ userId: 1 })
BalanceSchema.index({ userId: 1, "lockedCapitalLots.lockEnd": 1 })

export default createModelProxy<IBalance>("Balance", BalanceSchema)
