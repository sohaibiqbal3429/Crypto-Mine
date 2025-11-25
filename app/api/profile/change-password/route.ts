import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { comparePassword, getUserFromRequest, hashPassword } from "@/lib/auth"
import dbConnect from "@/lib/mongodb"
import { isOTPExpired } from "@/lib/utils/otp"
import { passwordSchema } from "@/lib/utils/validation"
import OTP from "@/models/OTP"
import User from "@/models/User"

const getErrorMessage = (error: unknown) => {
  if (error instanceof z.ZodError) return error.errors?.[0]?.message ?? error.message
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return "Unknown error"
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
  otpCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/u, "Enter the 6-digit code we emailed you"),
})

export async function POST(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { currentPassword, newPassword, otpCode } = changePasswordSchema.parse(await request.json())

    await dbConnect()

    const user = await User.findById(userPayload.userId)
    if (!user) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 })
    }

    const isCurrentPasswordValid = await comparePassword(currentPassword, user.passwordHash)
    if (!isCurrentPasswordValid) {
      return NextResponse.json({ success: false, message: "Current password is incorrect" }, { status: 400 })
    }

    const isSamePassword = await comparePassword(newPassword, user.passwordHash)
    if (isSamePassword) {
      return NextResponse.json({ success: false, message: "New password must be different from the current password" }, { status: 400 })
    }

    if (!user.email) {
      return NextResponse.json({ success: false, message: "Email verification is required before changing your password" }, { status: 400 })
    }

    const otpRecord = await OTP.findOne({
      email: user.email,
      purpose: "password_reset",
    }).sort({ createdAt: -1 })

    if (!otpRecord) {
      return NextResponse.json({ success: false, message: "Request a verification code before changing your password" }, { status: 400 })
    }

    if (otpRecord.code !== otpCode) {
      return NextResponse.json({ success: false, message: "The verification code you entered is incorrect" }, { status: 400 })
    }

    if (isOTPExpired(otpRecord.expiresAt)) {
      await OTP.deleteOne({ _id: otpRecord._id })
      return NextResponse.json({ success: false, message: "Your verification code has expired. Request a new one." }, { status: 400 })
    }

    user.passwordHash = await hashPassword(newPassword)
    await user.save()

    await OTP.deleteOne({ _id: otpRecord._id })

    return NextResponse.json({ success: true, message: "Password updated successfully" })
  } catch (error) {
    console.error("Change password error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, message: getErrorMessage(error) }, { status: 400 })
    }

    return NextResponse.json({ success: false, message: getErrorMessage(error) }, { status: 500 })
  }
}
