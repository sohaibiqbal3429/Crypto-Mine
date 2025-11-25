import mongoose from "mongoose"

import { createModelProxy } from "../lib/in-memory/model-factory"

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
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "inactive",
      index: true,
    },
    isActive: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false, index: true },
    blockedAt: { type: Date, default: null },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    depositTotal: { type: Number, default: 0 },
    withdrawTotal: { type: Number, default: 0 },
    roiEarnedTotal: { type: Number, default: 0 },
    level: { type: Number, default: 0 },
    directActiveCount: { type: Number, default: 0 },
    totalActiveDirects: { type: Number, default: 0 },
    lastLevelUpAt: { type: Date, default: null },
    qualified: { type: Boolean, default: false },
    qualifiedAt: { type: Date, default: null },
    kycStatus: {
      type: String,
      enum: ["unverified", "pending", "verified", "rejected"],
      default: "unverified",
    },
    groups: {
        A: [{ type: Schema.Types.ObjectId, ref: "User" }],
        B: [{ type: Schema.Types.ObjectId, ref: "User" }],
        C: [{ type: Schema.Types.ObjectId, ref: "User" }],
      D: [{ type: Schema.Types.ObjectId, ref: "User" }],
    },
    profileAvatar: { type: String, default: "avatar-01" },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
)

UserSchema.index({ createdAt: -1 })
UserSchema.index({ email: 1 }, { unique: true })
UserSchema.index({ status: 1, createdAt: -1 })
UserSchema.index({ phone: 1 })
UserSchema.index({ referralCode: 1 })
UserSchema.index({ referredBy: 1 })

export default createModelProxy("User", UserSchema)
