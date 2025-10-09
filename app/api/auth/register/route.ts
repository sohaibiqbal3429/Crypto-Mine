import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Balance from "@/models/Balance"
import { registerSchema } from "@/lib/validations/auth"
import { TOKEN_MAX_AGE_SECONDS, hashPassword, signToken } from "@/lib/auth"
import { generateReferralCode } from "@/lib/utils/referral"

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Starting registration process...")

    await dbConnect()
    console.log("[v0] Database connected successfully")

    const body = await request.json()
    console.log("[v0] Request body received:", { ...body, password: "[HIDDEN]" })

    const validatedData = registerSchema.parse(body)
    console.log("[v0] Data validation passed")

    // Check if user already exists
    const [existingEmail, existingPhone] = await Promise.all([
      User.findOne({ email: validatedData.email.toLowerCase() }),
      User.findOne({ phone: validatedData.phone }),
    ])

    if (existingEmail) {
      console.log("[v0] User already exists with email:", validatedData.email)
      return NextResponse.json({ error: "Email already in use" }, { status: 400 })
    }

    if (existingPhone) {
      console.log("[v0] User already exists with phone:", validatedData.phone)
      return NextResponse.json({ error: "Phone number already in use" }, { status: 400 })
    }

    // Verify referral code exists
    console.log("[v0] Checking referral code:", validatedData.referralCode)
    const referrer = await User.findOne({ referralCode: validatedData.referralCode })
    if (!referrer) {
      console.log("[v0] Invalid referral code:", validatedData.referralCode)
      return NextResponse.json({ error: "Invalid referral code" }, { status: 400 })
    }
    console.log("[v0] Valid referrer found:", referrer.name)

    // Generate unique referral code for new user
    let newReferralCode: string
    do {
      newReferralCode = generateReferralCode()
    } while (await User.findOne({ referralCode: newReferralCode }))
    console.log("[v0] Generated new referral code:", newReferralCode)

    // Hash password
    const passwordHash = await hashPassword(validatedData.password)
    console.log("[v0] Password hashed successfully")

    // Create user
    const user = await User.create({
      name: validatedData.name,
      email: validatedData.email.toLowerCase(),
      phone: validatedData.phone,
      passwordHash,
      referralCode: newReferralCode,
      referredBy: referrer._id,
    })
    console.log("[v0] User created successfully:", user._id)

    // Create initial balance
    await Balance.create({
      userId: user._id,
    })
    console.log("[v0] Initial balance created")

    // Generate JWT token
    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    })
    console.log("[v0] JWT token generated")

    const response = NextResponse.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        referralCode: user.referralCode,
      },
    })

    // Set HTTP-only cookie
    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: TOKEN_MAX_AGE_SECONDS,
      path: "/",
    })

    console.log("[v0] Registration completed successfully")
    return response
  } catch (error: any) {
    console.error("[v0] Registration error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    })

    if (error.name === "ZodError") {
      console.log("[v0] Validation error:", error.errors)
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 })
    }

    if (error.message?.includes("MONGODB_URI")) {
      return NextResponse.json(
        { error: "Database configuration error. Please check your MongoDB URI." },
        { status: 500 },
      )
    }

    if (error.message?.includes("connect")) {
      return NextResponse.json(
        { error: "Database connection failed. Please check your MongoDB connection." },
        { status: 500 },
      )
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
