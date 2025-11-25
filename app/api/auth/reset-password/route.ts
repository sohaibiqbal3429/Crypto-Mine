import { type NextRequest, NextResponse } from "next/server"

import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import OTP from "@/models/OTP"
import { resetPasswordSchema } from "@/lib/validations/auth"
import { hashPassword } from "@/lib/auth"
import { normalizeEmail } from "@/lib/utils/otp"
import { ZodError } from "zod"

const getErrorMessage = (error: unknown) => {
  if (error instanceof ZodError) return error.errors?.[0]?.message ?? error.message
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return "Unknown error"
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect()

    const body = await request.json()
    const { email, password, otpCode } = resetPasswordSchema.parse(body)

    const normalizedEmail = normalizeEmail(email)
    if (!normalizedEmail) {
      return NextResponse.json({ success: false, message: "Invalid email" }, { status: 400 })
    }

    const otpRecord = await OTP.findOne({
      email: normalizedEmail,
      code: otpCode,
      purpose: "password_reset",
      verified: true,
    })

    if (!otpRecord) {
      return NextResponse.json({ success: false, message: "Invalid or unverified verification code" }, { status: 400 })
    }

    const user = await User.findOne({ email: normalizedEmail })

    if (!user) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 })
    }

    const passwordHash = await hashPassword(password)
    user.passwordHash = passwordHash
    await user.save()

    await OTP.deleteOne({ _id: otpRecord._id })

    return NextResponse.json({
      success: true,
      message: "Password updated successfully",
    })
  } catch (error: any) {
    console.error("Reset password error:", error)

    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, message: getErrorMessage(error), details: error.errors },
        { status: 400 },
      )
    }

    return NextResponse.json({ success: false, message: getErrorMessage(error) }, { status: 500 })
  }
}
