import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Balance from "@/models/Balance"
import OTP from "@/models/OTP"
import { hashPassword, signToken } from "@/lib/auth"
import { generateReferralCode } from "@/lib/utils/referral"
import { z } from "zod"

const registerWithOTPSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    referralCode: z.string().min(1, "Referral code is required"),
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
    const validatedData = registerWithOTPSchema.parse(body)

    // Verify OTP first
    const query: any = {
      code: validatedData.otpCode,
      purpose: "registration",
      verified: true,
    }
    if (validatedData.email) query.email = validatedData.email
    if (validatedData.phone) query.phone = validatedData.phone

    const otpRecord = await OTP.findOne(query)
    if (!otpRecord) {
      return NextResponse.json({ error: "Invalid or unverified OTP code" }, { status: 400 })
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: validatedData.email }, { phone: validatedData.phone }].filter(Boolean),
    })

    if (existingUser) {
      return NextResponse.json({ error: "User already exists with this email or phone" }, { status: 400 })
    }

    // Verify referral code exists
    const referrer = await User.findOne({ referralCode: validatedData.referralCode })
    if (!referrer) {
      return NextResponse.json({ error: "Invalid referral code" }, { status: 400 })
    }

    // Generate unique referral code for new user
    let newReferralCode: string
    do {
      newReferralCode = generateReferralCode()
    } while (await User.findOne({ referralCode: newReferralCode }))

    // Hash password
    const passwordHash = await hashPassword(validatedData.password)

    // Create user
    const userData: any = {
      name: validatedData.name,
      passwordHash,
      referralCode: newReferralCode,
      referredBy: referrer._id,
      isActive: true, // User is active since they verified their contact
    }

    if (validatedData.email) {
      userData.email = validatedData.email
      userData.emailVerified = true
    }

    if (validatedData.phone) {
      userData.phone = validatedData.phone
      userData.phoneVerified = true
    }

    const user = await User.create(userData)

    // Create initial balance
    await Balance.create({
      userId: user._id,
    })

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
    console.error("Registration with OTP error:", error)

    if (error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
