import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import OTP from "@/models/OTP"
import { signToken } from "@/lib/auth"
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

    // Verify OTP first
    const query: any = {
      code: validatedData.otpCode,
      purpose: "login",
      verified: true,
    }
    if (validatedData.email) query.email = validatedData.email
    if (validatedData.phone) query.phone = validatedData.phone

    const otpRecord = await OTP.findOne(query)
    if (!otpRecord) {
      return NextResponse.json({ error: "Invalid or unverified OTP code" }, { status: 400 })
    }

    // Find user
    const userQuery: any = {}
    if (validatedData.email) userQuery.email = validatedData.email
    if (validatedData.phone) userQuery.phone = validatedData.phone

    const user = await User.findOne(userQuery)
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
