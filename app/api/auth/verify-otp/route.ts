import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import OTP from "@/models/OTP"
import { isOTPExpired } from "@/lib/utils/otp"
import { z } from "zod"

const verifyOTPSchema = z
  .object({
    code: z.string().length(6, "OTP must be 6 digits"),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    purpose: z.enum(["registration", "login", "password_reset"]).default("registration"),
  })
  .refine((data) => data.email || data.phone, {
    message: "Either email or phone must be provided",
  })

export async function POST(request: NextRequest) {
  try {
    await dbConnect()

    const body = await request.json()
    const validatedData = verifyOTPSchema.parse(body)

    const { code, email, phone, purpose } = validatedData

    // Find OTP record
    const query: any = { code, purpose, verified: false }
    if (email) query.email = email
    if (phone) query.phone = phone

    const otpRecord = await OTP.findOne(query)

    if (!otpRecord) {
      return NextResponse.json({ error: "Invalid or expired OTP code" }, { status: 400 })
    }

    // Check if OTP is expired
    if (isOTPExpired(otpRecord.expiresAt)) {
      await OTP.deleteOne({ _id: otpRecord._id })
      return NextResponse.json({ error: "OTP code has expired" }, { status: 400 })
    }

    // Check attempt limit
    if (otpRecord.attempts >= 5) {
      await OTP.deleteOne({ _id: otpRecord._id })
      return NextResponse.json({ error: "Too many failed attempts. Please request a new code." }, { status: 400 })
    }

    // Increment attempts
    otpRecord.attempts += 1

    // Verify code
    if (otpRecord.code !== code) {
      await otpRecord.save()
      return NextResponse.json(
        { error: `Invalid OTP code. ${5 - otpRecord.attempts} attempts remaining.` },
        { status: 400 },
      )
    }

    // Mark as verified
    otpRecord.verified = true
    await otpRecord.save()

    return NextResponse.json({
      success: true,
      message: "OTP verified successfully",
    })
  } catch (error: any) {
    console.error("Verify OTP error:", error)

    if (error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to verify OTP" }, { status: 500 })
  }
}
