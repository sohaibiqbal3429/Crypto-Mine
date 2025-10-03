import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import OTP from "@/models/OTP"
import { isOTPExpired } from "@/lib/utils/otp"
import { buildContactQuery, normalizeContact } from "@/lib/utils/contact"
import type { IOTP } from "@/models/OTP"
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

    const contact = normalizeContact(validatedData.email, validatedData.phone)
    const { purpose } = validatedData
    const otpCode = validatedData.code.trim()

    const otpQuery: Record<string, unknown> = { purpose }
    const contactQuery = buildContactQuery<IOTP>(contact)
    if (contactQuery) {
      Object.assign(otpQuery, contactQuery)
    }

    // Always look up the latest OTP for this contact + purpose
    const otpRecord = await OTP.findOne(otpQuery).sort({ createdAt: -1 })

    if (!otpRecord) {
      return NextResponse.json({ error: "Invalid or expired OTP code" }, { status: 400 })
    }

    // Check if OTP is expired
    if (isOTPExpired(otpRecord.expiresAt)) {
      await OTP.deleteOne({ _id: otpRecord._id })
      return NextResponse.json({ error: "OTP code has expired" }, { status: 400 })
    }

    // If the OTP was already verified (e.g. registration failed later), allow the
    // user to continue without forcing them to request a new code as long as the
    // submitted code matches.
    if (otpRecord.verified) {
      if (otpRecord.code === otpCode) {
        return NextResponse.json({
          success: true,
          message: "OTP verified successfully",
        })
      }

      return NextResponse.json({ error: "Invalid or expired OTP code" }, { status: 400 })
    }

    // Check attempt limit
    if (otpRecord.attempts >= 5) {
      await OTP.deleteOne({ _id: otpRecord._id })
      return NextResponse.json({ error: "Too many failed attempts. Please request a new code." }, { status: 400 })
    }

    // Verify code
    if (otpRecord.code !== otpCode) {
      otpRecord.attempts += 1
      await otpRecord.save()
      return NextResponse.json(
        { error: `Invalid OTP code. ${Math.max(0, 5 - otpRecord.attempts)} attempts remaining.` },
        { status: 400 },
      )
    }

    // Mark as verified and persist the successful attempt
    otpRecord.verified = true
    otpRecord.attempts += 1
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
