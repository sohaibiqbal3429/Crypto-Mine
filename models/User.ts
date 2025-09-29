import mongoose, { Schema, type Document } from "mongoose"

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
UserSchema.index({ phone: 1 }) // Added phone index
UserSchema.index({ referralCode: 1 })
UserSchema.index({ referredBy: 1 })

export default mongoose.models.User || mongoose.model<IUser>("User", UserSchema)
