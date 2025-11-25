import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export interface IOTP extends Document {
  userId?: mongoose.Types.ObjectId
  email?: string
  phone?: string
  code: string
  type: "email" | "sms"
  purpose: "registration" | "login" | "password_reset"
  expiresAt: Date
  verified: boolean
  attempts: number
  createdAt: Date
}

const OTPSchema = new Schema<IOTP>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    email: { type: String, lowercase: true },
    phone: { type: String },
    code: { type: String, required: true },
    type: { type: String, enum: ["email", "sms"], required: true },
    purpose: { type: String, enum: ["registration", "login", "password_reset"], required: true },
    expiresAt: { type: Date, required: true },
    verified: { type: Boolean, default: false },
    attempts: { type: Number, default: 0, max: 5 },
  },
  {
    timestamps: true,
  },
)

// Index for cleanup of expired OTPs
OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
OTPSchema.index({ email: 1, type: 1, purpose: 1 })
OTPSchema.index({ phone: 1, type: 1, purpose: 1 })

export default createModelProxy<IOTP>("OTP", OTPSchema)
