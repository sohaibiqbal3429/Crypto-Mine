import mongoose, { Schema, type Document } from "mongoose"

export interface IBalance extends Document {
  userId: mongoose.Types.ObjectId
  current: number
  totalBalance: number
  totalEarning: number
  lockedCapital: number
  staked: number
  pendingWithdraw: number
  teamRewardsAvailable: number
  teamRewardsClaimed: number
  teamRewardsLastClaimedAt?: Date
  updatedAt: Date
}

const BalanceSchema = new Schema<IBalance>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    current: { type: Number, default: 0 },
    totalBalance: { type: Number, default: 0 },
    totalEarning: { type: Number, default: 0 },
    lockedCapital: { type: Number, default: 0 },
    staked: { type: Number, default: 0 },
    pendingWithdraw: { type: Number, default: 0 },
    teamRewardsAvailable: { type: Number, default: 0 },
    teamRewardsClaimed: { type: Number, default: 0 },
    teamRewardsLastClaimedAt: { type: Date },
  },
  {
    timestamps: true,
  },
)

BalanceSchema.index({ userId: 1 })

export default mongoose.models.Balance || mongoose.model<IBalance>("Balance", BalanceSchema)
