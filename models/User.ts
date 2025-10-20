import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export interface IUser extends Document {
  email: string
  phone?: string // Added phone field for OTP authentication
  passwordHash: string
  name: string
  role: "user" | "admin"
  referralCode: string
  referredBy?: mongoose.Types.ObjectId
  status: "active" | "inactive" | "suspended"
  isActive: boolean
  isBlocked: boolean
  blockedAt?: Date | null
  emailVerified: boolean // Added email verification status
  phoneVerified: boolean // Added phone verification status
  depositTotal: number
  withdrawTotal: number
  roiEarnedTotal: number
  level: number
  directActiveCount: number
  totalActiveDirects: number
  lastLevelUpAt?: Date | null
  qualified: boolean
  qualifiedAt?: Date | null
  kycStatus: "unverified" | "pending" | "verified" | "rejected"
  groups: {
    A: mongoose.Types.ObjectId[]
    B: mongoose.Types.ObjectId[]
    C: mongoose.Types.ObjectId[]
    D: mongoose.Types.ObjectId[]
  }
  profileAvatar: string
  lastLoginAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String, unique: true, sparse: true }, // Added phone field with sparse index
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
    emailVerified: { type: Boolean, default: false }, // Added email verification tracking
    phoneVerified: { type: Boolean, default: false }, // Added phone verification tracking
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
UserSchema.index({ referredBy: 1 })

UserSchema.pre("save", function (next) {
  if (this.isModified("isActive") && !this.isModified("status")) {
    this.status = this.isActive ? "active" : "inactive"
  }

  if (this.isModified("status")) {
    if (this.status === "active") {
      this.isActive = true
    } else if (this.status === "inactive") {
      this.isActive = false
    }
  }

  next()
})

export default createModelProxy<IUser>("User", UserSchema)
