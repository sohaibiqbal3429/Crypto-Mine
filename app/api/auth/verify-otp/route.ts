import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import OTP from "@/models/OTP"
import { isOTPExpired, normalizeEmail, normalizePhoneNumber } from "@/lib/utils/otp"
import { z, ZodError } from "zod"

const getErrorMessage = (error: unknown) => {
  if (error instanceof ZodError) return error.errors?.[0]?.message ?? error.message
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return "Unknown error"
}

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
    const validatedData = verifyOTPSchema.parse({
      ...body,
      email: normalizeEmail(body?.email),
      phone: normalizePhoneNumber(body?.phone),
    })

    const { code, purpose } = validatedData
    const email = normalizeEmail(validatedData.email)
    const phone = normalizePhoneNumber(validatedData.phone)

    const baseQuery: Record<string, unknown> = { purpose }
    if (email) baseQuery.email = email
    if (phone) baseQuery.phone = phone

    // Always look up the latest OTP for this contact + purpose
    const otpRecord = await OTP.findOne(baseQuery).sort({ createdAt: -1 })

    if (!otpRecord) {
      return NextResponse.json({ success: false, message: "Invalid or expired OTP code" }, { status: 400 })
    }

    // Check if OTP is expired
    if (isOTPExpired(otpRecord.expiresAt)) {
      await OTP.deleteOne({ _id: otpRecord._id })
      return NextResponse.json({ success: false, message: "OTP code has expired" }, { status: 400 })
    }

    // If the OTP was already verified (e.g. registration failed later), allow the
    // user to continue without forcing them to request a new code as long as the
    // submitted code matches.
    if (otpRecord.verified) {
      if (otpRecord.code === code) {
        return NextResponse.json({
          success: true,
          message: "OTP verified successfully",
        })
      }

      return NextResponse.json({ success: false, message: "Invalid or expired OTP code" }, { status: 400 })
    }

    // Check attempt limit
    if (otpRecord.attempts >= 5) {
      await OTP.deleteOne({ _id: otpRecord._id })
      return NextResponse.json({ success: false, message: "Too many failed attempts. Please request a new code." }, { status: 400 })
    }

    // Verify code
    if (otpRecord.code !== code) {
      otpRecord.attempts += 1
      await otpRecord.save()
      return NextResponse.json(
        { success: false, message: `Invalid OTP code. ${Math.max(0, 5 - otpRecord.attempts)} attempts remaining.` },
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

    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, message: getErrorMessage(error), details: error.errors },
        { status: 400 },
      )
    }

    return NextResponse.json({ success: false, message: getErrorMessage(error) }, { status: 500 })
  }
}
