import mongoose from "mongoose"

import { createModelProxy } from "../lib/in-memory/model-factory.js"

const { Schema } = mongoose

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String, unique: true, sparse: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    referralCode: { type: String, required: true, unique: true },
    referredBy: { type: Schema.Types.ObjectId, ref: "User" },
    isActive: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    depositTotal: { type: Number, default: 0 },
    withdrawTotal: { type: Number, default: 0 },
    roiEarnedTotal: { type: Number, default: 0 },
    level: { type: Number, default: 0 },
    groups: {
      A: [{ type: Schema.Types.ObjectId, ref: "User" }],
      B: [{ type: Schema.Types.ObjectId, ref: "User" }],
      C: [{ type: Schema.Types.ObjectId, ref: "User" }],
      D: [{ type: Schema.Types.ObjectId, ref: "User" }],
    },
  },
  {
    timestamps: true,
  },
)

UserSchema.index({ email: 1 })
UserSchema.index({ phone: 1 })
UserSchema.index({ referralCode: 1 })
UserSchema.index({ referredBy: 1 })

export default createModelProxy("User", UserSchema)
