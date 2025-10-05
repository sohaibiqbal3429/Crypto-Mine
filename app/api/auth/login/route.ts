import { type NextRequest, NextResponse } from "next/server"

import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import { loginSchema } from "@/lib/validations/auth"
import { comparePassword, signToken } from "@/lib/auth"
import { buildPhoneSearch } from "@/lib/utils/phone"

export async function POST(request: NextRequest) {
  try {
    await dbConnect()

    const body = await request.json()
    const validatedData = loginSchema.parse(body)

    const { identifier, identifierType, password } = validatedData

    let user = null

    if (identifierType === "email") {
      user = await User.findOne({ email: identifier.toLowerCase() })
    } else {
      const phoneLookup = buildPhoneSearch(identifier)

      if (!phoneLookup) {
        return NextResponse.json({ error: "Invalid phone number" }, { status: 400 })
      }

      user = await User.findOne({
        $or: phoneLookup.queries,
      })

      if (user && phoneLookup.canonical && user.phone !== phoneLookup.canonical) {
        user.phone = phoneLookup.canonical
        try {
          await user.save()
        } catch (updateError) {
          console.warn("Failed to normalise phone during login", updateError)
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.passwordHash)
    if (!isValidPassword) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

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
        role: user.role,
        referralCode: user.referralCode,
        phone: user.phone,
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
    console.error("Login error:", error)

    if (error.name === "ZodError") {
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
