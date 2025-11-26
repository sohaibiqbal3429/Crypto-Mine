import { type NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"

import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import { loginSchema } from "@/lib/validations/auth"
import { TOKEN_MAX_AGE_SECONDS, comparePassword, signToken } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = loginSchema.parse(body)

    await dbConnect()

    const { identifier, identifierType, password } = validatedData

    const query =
      identifierType === "email"
        ? { email: identifier.toLowerCase() }
        : { phone: identifier }

    const user = await User.findOne(query)
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 })
    }

    const isValidPassword = await comparePassword(password, user.passwordHash)
    if (!isValidPassword) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 })
    }

    if (user.isBlocked) {
      user.lastLoginAt = new Date()
      await user.save()
      return NextResponse.json(
        {
          error: "Your account has been blocked by an administrator.",
          blocked: true,
        },
        { status: 403 },
      )
    }

    user.lastLoginAt = new Date()
    await user.save()

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
        isBlocked: user.isBlocked,
      },
    })

    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: TOKEN_MAX_AGE_SECONDS,
      path: "/",
    })

    return response
  } catch (error: unknown) {
    console.error("Login error:", error)

    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 })
    }

    if (error instanceof Error && error.message) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
