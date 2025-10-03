import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import OTP from "@/models/OTP"
import { generateOTP, getOTPExpiry, formatPhoneNumber, validatePhoneNumber } from "@/lib/utils/otp"
import { sendOTPEmail } from "@/lib/utils/email"
import { sendOTPSMS } from "@/lib/utils/sms"
import { z } from "zod"

const sendOTPSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
    purpose: z.enum(["registration", "login", "password_reset"]).default("registration"),
  })
  .refine((data) => data.email || data.phone, {
    message: "Either email or phone must be provided",
  })

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Send OTP API called")
    await dbConnect()
    console.log("[v0] Database connected successfully")

    const body = await request.json()
    console.log("[v0] Request body:", body)

    const validatedData = sendOTPSchema.parse(body)
    console.log("[v0] Data validated:", validatedData)

    const { email, phone, purpose } = validatedData

    // Generate OTP
    const otpCode = generateOTP(6)
    const expiresAt = getOTPExpiry(10) // 10 minutes
    console.log("[v0] Generated OTP:", otpCode)

    if (email) {
      console.log("[v0] Processing email OTP for:", email)

      // Delete any existing OTPs for this email
      await OTP.deleteMany({ email, purpose, verified: false })
      console.log("[v0] Deleted existing OTPs")

      // Create new OTP record
      const otpRecord = await OTP.create({
        email,
        code: otpCode,
        type: "email",
        purpose,
        expiresAt,
      })
      console.log("[v0] Created OTP record:", otpRecord._id)

      const hasEmailConfig = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS)

      if (!hasEmailConfig) {
        console.error("[v0] Email configuration missing. Cannot send OTP email.")
        return NextResponse.json(
          { error: "Email service is not configured. Please contact support." },
          { status: 500 },
        )
      }

      try {
        // Send email
        await sendOTPEmail(email, otpCode, purpose)
        console.log("[v0] Email sent successfully")
      } catch (emailError) {
        console.error("[v0] Email sending failed:", emailError)
        return NextResponse.json(
          { error: "Failed to send verification email. Please try again later." },
          { status: 500 },
        )
      }

      return NextResponse.json({
        success: true,
        message: "OTP sent to your email address",
      })
    }

    if (phone) {
      console.log("[v0] Processing phone OTP for:", phone)

      // Validate and format phone number
      const validation = validatePhoneNumber(phone)
      if (!validation.isValid) {
        console.log("[v0] Invalid phone number format")
        return NextResponse.json({ error: "Invalid phone number format" }, { status: 400 })
      }

      const formattedPhone = formatPhoneNumber(phone)
      console.log("[v0] Formatted phone:", formattedPhone)

      // Delete any existing OTPs for this phone
      await OTP.deleteMany({ phone: formattedPhone, purpose, verified: false })
      console.log("[v0] Deleted existing phone OTPs")

      // Create new OTP record
      const otpRecord = await OTP.create({
        phone: formattedPhone,
        code: otpCode,
        type: "sms",
        purpose,
        expiresAt,
      })
      console.log("[v0] Created phone OTP record:", otpRecord._id)

      const hasSMSConfig = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)

      if (!hasSMSConfig) {
        console.error("[v0] SMS configuration missing. Cannot send OTP SMS.")
        return NextResponse.json(
          { error: "SMS service is not configured. Please use email verification." },
          { status: 500 },
        )
      }

      try {
        // Send SMS
        await sendOTPSMS(formattedPhone, otpCode, purpose)
        console.log("[v0] SMS sent successfully")
      } catch (smsError) {
        console.error("[v0] SMS sending failed:", smsError)
        return NextResponse.json(
          { error: "Failed to send verification code via SMS. Please try again later." },
          { status: 500 },
        )
      }

      return NextResponse.json({
        success: true,
        message: "OTP sent to your phone number",
      })
    }

    return NextResponse.json({ error: "Either email or phone must be provided" }, { status: 400 })
  } catch (error: any) {
    console.error("[v0] Send OTP error:", error)

    if (error.name === "ZodError") {
      console.log("[v0] Validation error:", error.errors)
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 })
    }

    if (error.message?.includes("connect")) {
      return NextResponse.json({ error: "Database connection failed. Please try again." }, { status: 500 })
    }

    return NextResponse.json({ error: "Failed to send OTP. Please try again." }, { status: 500 })
  }
}
