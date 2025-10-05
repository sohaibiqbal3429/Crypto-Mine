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
    first_qualifying_deposit_at: { type: Date, default: null },
    first_qualifying_deposit_amount: { type: Number, default: null },
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

UserSchema.virtual("firstQualifyingDepositAt")
  .get(function () {
    return this.first_qualifying_deposit_at ?? null
  })
  .set(function (value) {
    this.set("first_qualifying_deposit_at", value ?? null)
  })

UserSchema.virtual("firstQualifyingDepositAmount")
  .get(function () {
    return this.first_qualifying_deposit_amount ?? null
  })
  .set(function (value) {
    this.set("first_qualifying_deposit_amount", value ?? null)
  })

export default createModelProxy("User", UserSchema)
