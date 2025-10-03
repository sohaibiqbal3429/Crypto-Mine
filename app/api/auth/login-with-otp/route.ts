import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import OTP from "@/models/OTP"
import { signToken } from "@/lib/auth"
import { isOTPExpired } from "@/lib/utils/otp"
import { z } from "zod"

const loginWithOTPSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
    otpCode: z.string().length(6, "OTP must be 6 digits"),
  })
  .refine((data) => data.email || data.phone, {
    message: "Either email or phone must be provided",
  })

export async function POST(request: NextRequest) {
  try {
    await dbConnect()

    const body = await request.json()
    const validatedData = loginWithOTPSchema.parse(body)
    const email = validatedData.email?.toLowerCase()
    const phone = validatedData.phone

    // Verify OTP first
    const contactFilters: Record<string, string>[] = []
    if (email) {
      contactFilters.push({ email })
    }
    if (phone) {
      contactFilters.push({ phone })
    }

    const otpQuery: Record<string, unknown> = { purpose: "login" }
    if (contactFilters.length === 1) {
      Object.assign(otpQuery, contactFilters[0])
    } else if (contactFilters.length > 1) {
      otpQuery.$or = contactFilters
    }

    const otpRecord = await OTP.findOne(otpQuery).sort({ createdAt: -1 })
    if (!otpRecord || otpRecord.code !== validatedData.otpCode) {
      return NextResponse.json({ error: "Invalid or unverified OTP code" }, { status: 400 })
    }

    if (isOTPExpired(otpRecord.expiresAt)) {
      await OTP.deleteOne({ _id: otpRecord._id })
      return NextResponse.json({ error: "OTP code has expired" }, { status: 400 })
    }

    if (!otpRecord.verified) {
      otpRecord.verified = true
      await otpRecord.save()
    }

    // Find user
    let userQuery: Record<string, unknown> | null = null
    if (contactFilters.length === 1) {
      userQuery = contactFilters[0]
    } else if (contactFilters.length > 1) {
      userQuery = { $or: contactFilters }
    }

    const user = userQuery ? await User.findOne(userQuery) : null
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Clean up used OTP
    await OTP.deleteOne({ _id: otpRecord._id })

    // Generate JWT token
    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    })

    const response = NextResponse.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        referralCode: user.referralCode,
      },
    })

    // Set HTTP-only cookie
    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    })

    return response
  } catch (error: any) {
    console.error("Login with OTP error:", error)

    if (error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
