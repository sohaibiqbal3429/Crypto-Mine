import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export interface IWalletAddress extends Document {
  userId: mongoose.Types.ObjectId
  label: string
  chain: string
  address: string
  verified: boolean
  createdAt: Date
}

const WalletAddressSchema = new Schema<IWalletAddress>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    label: { type: String, required: true },
    chain: { type: String, required: true },
    address: { type: String, required: true },
    verified: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
)

WalletAddressSchema.index({ userId: 1 })
WalletAddressSchema.index({ userId: 1, address: 1 }, { unique: true })

export default createModelProxy<IWalletAddress>("WalletAddress", WalletAddressSchema)
