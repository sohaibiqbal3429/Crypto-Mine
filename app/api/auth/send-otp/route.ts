// app/api/send-otp/route.ts
import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import OTP from "@/models/OTP"
import {
  generateOTP,
  getOTPExpiry,
  formatPhoneNumber,
  validatePhoneNumber,
  normalizeEmail,
  normalizePhoneNumber,
} from "@/lib/utils/otp"
import { sendOTPEmail } from "@/lib/utils/email"
import { sendOTPSMS } from "@/lib/utils/sms"
import { z, ZodError } from "zod"
import { normalizeSMTPError } from "@/lib/utils/smtp-error"

const getErrorMessage = (error: unknown) => {
  if (error instanceof ZodError) return error.errors?.[0]?.message ?? error.message
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return "Unknown error"
}

const sendOTPSchema = z
  .object({
    email: z
      .string()
      .email("Invalid email address")
      .optional(),
    phone: z.string().optional(),
    purpose: z
      .enum(["registration", "login", "password_reset"])
      .default("registration"),
  })
  .refine((data) => !!data.email || !!data.phone, {
    message: "Either email or phone must be provided",
  })

export async function POST(request: NextRequest) {
  console.log("[send-otp] API called")

  try {
    await dbConnect()
    console.log("[send-otp] Database connected")

    // ----- Parse & validate body -----
    const rawBody = await request.json()
    console.log("[send-otp] Raw body:", rawBody)

    // Normalise & trim incoming data before validation
    const body = sendOTPSchema.parse({
      email: normalizeEmail(typeof rawBody.email === "string" ? rawBody.email : undefined),
      phone: normalizePhoneNumber(typeof rawBody.phone === "string" ? rawBody.phone : undefined),
      purpose: rawBody.purpose,
    })

    const { email, phone, purpose } = body
    console.log("[send-otp] Validated body:", { email, phone, purpose })

    // ----- Common OTP setup -----
    const otpCode = generateOTP(6)
    const expiresAt = getOTPExpiry(10) // 10 minutes
    console.log("[send-otp] Generated OTP:", otpCode)

    const isProduction = process.env.NODE_ENV === "production"
    const allowDevOtp =
      process.env.NODE_ENV === "test" ||
      process.env.NODE_ENV === "development" ||
      process.env.ENABLE_DEV_OTP_FALLBACK === "true"
    const skipDelivery = process.env.NODE_ENV === "test" || process.env.SKIP_OTP_DELIVERY === "true"

    const buildDevResponse = (message: string) =>
      NextResponse.json(
        {
          success: true,
          message,
          devOtp: otpCode,
        },
        { status: 200 },
      )

    // ========================================================================
    // EMAIL OTP
    // ========================================================================
    if (email) {
      console.log("[send-otp] Processing EMAIL OTP for:", email)

      // Remove previous unverified OTPs for this email & purpose
      await OTP.deleteMany({ email, purpose, verified: false })
      console.log("[send-otp] Deleted existing email OTPs")

      // Create new OTP record
      const otpRecord = await OTP.create({
        email,
        code: otpCode,
        type: "email",
        purpose,
        expiresAt,
      })
      console.log("[send-otp] Created email OTP record:", otpRecord._id)

      if (skipDelivery) {
        console.warn("[send-otp] Skipping email delivery in test mode; returning dev OTP")
        return buildDevResponse("Verification code generated (delivery skipped for tests).")
      }

      const smtpHost = process.env.SMTP_HOST?.trim()
      const smtpPort = process.env.SMTP_PORT?.trim()
      const smtpUser = process.env.SMTP_USER?.trim()
      const smtpPass = process.env.SMTP_PASS?.trim()

      const hasEmailConfig =
        !!smtpHost &&
        !!smtpPort &&
        !!smtpUser &&
        !!smtpPass

      if (smtpHost) process.env.SMTP_HOST = smtpHost
      if (smtpPort) process.env.SMTP_PORT = smtpPort
      if (smtpUser) process.env.SMTP_USER = smtpUser
      if (smtpPass) process.env.SMTP_PASS = smtpPass

      // No SMTP config
      if (!hasEmailConfig) {
        console.error("[send-otp] Missing SMTP configuration")

        if (allowDevOtp) {
          console.warn(
            "[send-otp] Dev environment: returning devOtp instead of sending real email",
          )
          return buildDevResponse(
            "Email service is not configured in development. Use the OTP shown in the response.",
          )
        }

        // Production: fail hard
        return NextResponse.json(
          { success: false, message: "Email service is not configured. Please contact support." },
          { status: 500 },
        )
      }

      // Try sending email
      try {
        await sendOTPEmail(email, otpCode, purpose)
        console.log("[send-otp] OTP email sent successfully")

        return NextResponse.json({
          success: true,
          message: "OTP sent to your email address.",
        })
      } catch (err) {
        console.error("[send-otp] Failed to send OTP email:", err)
        const normalized = normalizeSMTPError(err, { environment: process.env.NODE_ENV })

        if (allowDevOtp) {
          console.warn(
            "[send-otp] Dev environment: email failed, returning devOtp instead",
          )
          return buildDevResponse(
            normalized.message +
              " Use the OTP shown in the response while email delivery is unavailable.",
          )
        }

        return NextResponse.json(
          {
            success: false,
            code: normalized.code,
            message: normalized.message,
            ...(normalized.hint ? { hint: normalized.hint } : {}),
            ...(normalized.debug ? { debug: normalized.debug } : {}),
          },
          { status: normalized.status },
        )
      }
    }

    // ========================================================================
    // PHONE / SMS OTP
    // ========================================================================
    if (phone) {
      console.log("[send-otp] Processing SMS OTP for:", phone)

      const validation = validatePhoneNumber(phone)
      if (!validation.isValid) {
        console.log("[send-otp] Invalid phone number format")
        return NextResponse.json(
          { success: false, message: "Invalid phone number format" },
          { status: 400 },
        )
      }

      const formattedPhone = formatPhoneNumber(phone)
      console.log("[send-otp] Formatted phone:", formattedPhone)

      // Remove previous unverified OTPs for this phone & purpose
      await OTP.deleteMany({ phone: formattedPhone, purpose, verified: false })
      console.log("[send-otp] Deleted existing phone OTPs")

      // Create new OTP record
      const otpRecord = await OTP.create({
        phone: formattedPhone,
        code: otpCode,
        type: "sms",
        purpose,
        expiresAt,
      })
      console.log("[send-otp] Created phone OTP record:", otpRecord._id)

      if (skipDelivery) {
        console.warn("[send-otp] Skipping SMS delivery in test mode; returning dev OTP")
        return buildDevResponse("Verification code generated (delivery skipped for tests).")
      }

      const twilioSid = process.env.TWILIO_ACCOUNT_SID?.trim()
      const twilioToken = process.env.TWILIO_AUTH_TOKEN?.trim()
      const twilioPhone = process.env.TWILIO_PHONE_NUMBER?.trim()

      const hasSMSConfig =
        !!twilioSid && !!twilioToken && !!twilioPhone

      if (twilioSid) process.env.TWILIO_ACCOUNT_SID = twilioSid
      if (twilioToken) process.env.TWILIO_AUTH_TOKEN = twilioToken
      if (twilioPhone) process.env.TWILIO_PHONE_NUMBER = twilioPhone

      if (!hasSMSConfig) {
        console.error("[send-otp] Missing SMS configuration")

        if (allowDevOtp) {
          console.warn(
            "[send-otp] Dev environment: returning devOtp instead of sending real SMS",
          )
          return buildDevResponse(
            "SMS service is not configured in development. Use the OTP shown in the response.",
          )
        }

        return NextResponse.json(
          {
            success: false,
            message: "SMS service is not configured. Please use email verification.",
          },
          { status: 500 },
        )
      }

      try {
        await sendOTPSMS(formattedPhone, otpCode, purpose)
        console.log("[send-otp] OTP SMS sent successfully")

        return NextResponse.json({
          success: true,
          message: "OTP sent to your phone number.",
        })
      } catch (err) {
        console.error("[send-otp] Failed to send OTP SMS:", err)

        if (!isProduction) {
          console.warn(
            "[send-otp] Dev environment: SMS failed, returning devOtp instead",
          )
          return buildDevResponse(
            "SMS delivery failed in development. Use the OTP shown in the response.",
          )
        }

        return NextResponse.json(
          { success: false, message: getErrorMessage(err) },
          { status: 500 },
        )
      }
    }

    // Should not be reachable because of schema refine, but just in case:
    return NextResponse.json(
      { success: false, message: "Either email or phone must be provided" },
      { status: 400 },
    )
  } catch (error: any) {
    console.error("[send-otp] Uncaught error:", error)

    if (error instanceof ZodError) {
      console.log("[send-otp] Validation error:", error.errors)
      return NextResponse.json(
        { success: false, message: getErrorMessage(error), details: error.errors },
        { status: 400 },
      )
    }

    if (typeof error?.message === "string" && error.message.includes("connect")) {
      return NextResponse.json(
        { success: false, message: getErrorMessage(error) },
        { status: 500 },
      )
    }

    return NextResponse.json(
      { success: false, message: getErrorMessage(error) },
      { status: 500 },
    )
  }
}
