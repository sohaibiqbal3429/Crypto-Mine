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
  isActive: boolean
  emailVerified: boolean // Added email verification status
  phoneVerified: boolean // Added phone verification status
  depositTotal: number
  withdrawTotal: number
  roiEarnedTotal: number
  level: number
  first_qualifying_deposit_at?: Date | null
  first_qualifying_deposit_amount?: number | null
  firstQualifyingDepositAt?: Date | null
  firstQualifyingDepositAmount?: number | null
  groups: {
    A: mongoose.Types.ObjectId[]
    B: mongoose.Types.ObjectId[]
    C: mongoose.Types.ObjectId[]
    D: mongoose.Types.ObjectId[]
  }
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
    isActive: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false }, // Added email verification tracking
    phoneVerified: { type: Boolean, default: false }, // Added phone verification tracking
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

UserSchema.index({ referredBy: 1 })

UserSchema.virtual("firstQualifyingDepositAt")
  .get(function (this: IUser & { first_qualifying_deposit_at?: Date | null }) {
    return this.first_qualifying_deposit_at ?? null
  })
  .set(function (this: IUser, value: Date | null) {
    this.set("first_qualifying_deposit_at", value ?? null)
  })

UserSchema.virtual("firstQualifyingDepositAmount")
  .get(function (this: IUser & { first_qualifying_deposit_amount?: number | null }) {
    return this.first_qualifying_deposit_amount ?? null
  })
  .set(function (this: IUser, value: number | null) {
    this.set("first_qualifying_deposit_amount", value ?? null)
  })

export default createModelProxy<IUser>("User", UserSchema)
