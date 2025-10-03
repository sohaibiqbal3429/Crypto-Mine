import { type NextRequest, NextResponse } from "next/server"

import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import OTP from "@/models/OTP"
import { resetPasswordSchema } from "@/lib/validations/auth"
import { hashPassword } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    await dbConnect()

    const body = await request.json()
    const { email, password, otpCode } = resetPasswordSchema.parse(body)

    const normalizedEmail = email.toLowerCase()

    const otpRecord = await OTP.findOne({
      email: normalizedEmail,
      code: otpCode,
      purpose: "password_reset",
      verified: true,
    })

    if (!otpRecord) {
      return NextResponse.json({ error: "Invalid or unverified verification code" }, { status: 400 })
    }

    const user = await User.findOne({ email: normalizedEmail })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
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

    if (error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
