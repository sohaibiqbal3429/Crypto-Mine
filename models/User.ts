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
  // Optional per-user mining rate override (percent, e.g., 1.5)
  miningDailyRateOverridePct?: number
  level: number
  levelCached?: number
  levelEvaluatedAt?: Date | null
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

type LeanReferral = { referredBy?: mongoose.Types.ObjectId | string | null }

async function assertNoReferralCycle(
  model: mongoose.Model<IUser>,
  userId: mongoose.Types.ObjectId,
  sponsorId: mongoose.Types.ObjectId,
) {
  if (userId.equals(sponsorId)) {
    throw new Error("Users cannot refer themselves")
  }

  const visited = new Set<string>()
  let current: mongoose.Types.ObjectId | null = sponsorId
  const self = userId.toString()

  while (current) {
    const currentStr = current.toString()
    if (currentStr === self) {
      throw new Error("Referral relationship would create a cycle")
    }

    if (visited.has(currentStr)) {
      break
    }
    visited.add(currentStr)

    const ancestor = (await model
      .findById(current)
      .select({ referredBy: 1 })
      .lean()) as LeanReferral | null

    if (!ancestor?.referredBy) {
      break
    }

    current = ancestor.referredBy instanceof mongoose.Types.ObjectId
      ? ancestor.referredBy
      : mongoose.Types.ObjectId.isValid(ancestor.referredBy)
        ? new mongoose.Types.ObjectId(String(ancestor.referredBy))
        : null
  }
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
    miningDailyRateOverridePct: { type: Number, required: false },
    level: { type: Number, default: 0 },
    levelCached: { type: Number, default: 0 },
    levelEvaluatedAt: { type: Date, default: null },
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

UserSchema.pre("save", async function (next) {
  try {
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

    if (this.isModified("referredBy") && this.referredBy) {
      const model = this.model("User") as mongoose.Model<IUser>
      const userId = this._id instanceof mongoose.Types.ObjectId ? this._id : new mongoose.Types.ObjectId(String(this._id))
      const sponsorId =
        this.referredBy instanceof mongoose.Types.ObjectId
          ? this.referredBy
          : new mongoose.Types.ObjectId(String(this.referredBy))

      await assertNoReferralCycle(model, userId, sponsorId)
    }

    next()
  } catch (error) {
    next(error as Error)
  }
})

UserSchema.pre("findOneAndUpdate", async function (next) {
  try {
    const model = (this as any).model as mongoose.Model<IUser>
    const updateDoc = (this.getUpdate() ?? {}) as Record<string, any>
    const referredBy =
      updateDoc.referredBy ??
      updateDoc.$set?.referredBy ??
      updateDoc.$setOnInsert?.referredBy

    if (typeof referredBy === "undefined") {
      return next()
    }

    if (!referredBy) {
      return next()
    }

    const existing = await model
      .findOne(this.getQuery())
      .select({ _id: 1 })
      .lean<{ _id: mongoose.Types.ObjectId | string }>()

    if (!existing?._id) {
      return next()
    }

    const userId = existing._id instanceof mongoose.Types.ObjectId ? existing._id : new mongoose.Types.ObjectId(String(existing._id))
    const sponsorId =
      referredBy instanceof mongoose.Types.ObjectId
        ? referredBy
        : new mongoose.Types.ObjectId(String(referredBy))

    await assertNoReferralCycle(model, userId, sponsorId)

    next()
  } catch (error) {
    next(error as Error)
  }
})

export default createModelProxy<IUser>("User", UserSchema)
