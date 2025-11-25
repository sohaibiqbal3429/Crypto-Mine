import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import OTP from "@/models/OTP"
import { TOKEN_MAX_AGE_SECONDS, signToken } from "@/lib/auth"
import { normalizeEmail, normalizePhoneNumber } from "@/lib/utils/otp"
import { z, ZodError } from "zod"

const getErrorMessage = (error: unknown) => {
  if (error instanceof ZodError) return error.errors?.[0]?.message ?? error.message
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return "Unknown error"
}

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
    const normalizedEmail = normalizeEmail(validatedData.email)
    const normalizedPhone = normalizePhoneNumber(validatedData.phone)

    // Verify OTP first
    const contactFilters: Record<string, string>[] = []
    if (normalizedEmail) {
      contactFilters.push({ email: normalizedEmail })
    }
    if (normalizedPhone) {
      contactFilters.push({ phone: normalizedPhone })
    }

    const otpQuery: Record<string, unknown> = {
      code: validatedData.otpCode,
      purpose: "login",
      verified: true,
    }

    if (contactFilters.length === 1) {
      Object.assign(otpQuery, contactFilters[0])
    } else if (contactFilters.length > 1) {
      otpQuery.$or = contactFilters
    }

    const otpRecord = await OTP.findOne(otpQuery)
    if (!otpRecord) {
      return NextResponse.json({ success: false, message: "Invalid or unverified OTP code" }, { status: 400 })
    }

    // Find user
    const userQuery: any = {}
    if (normalizedEmail) userQuery.email = normalizedEmail
    if (normalizedPhone) userQuery.phone = normalizedPhone

    const user = await User.findOne(userQuery)
    if (!user) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 })
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
      maxAge: TOKEN_MAX_AGE_SECONDS,
      path: "/",
    })

    return response
  } catch (error: any) {
    console.error("Login with OTP error:", error)

    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, message: getErrorMessage(error), details: error.errors },
        { status: 400 },
      )
    }

    return NextResponse.json({ success: false, message: getErrorMessage(error) }, { status: 500 })
  }
}
