import { type NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"

import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import { loginSchema, type LoginInput } from "@/lib/validations/auth"
import { TOKEN_MAX_AGE_SECONDS, comparePassword, signToken } from "@/lib/auth"

function resolveExternalLoginUrl() {
  const rawUrl =
    process.env.AUTH_SERVICE_LOGIN_URL ??
    process.env.AUTH_SERVICE_URL ??
    process.env.BACKEND_API_URL ??
    process.env.API_BASE_URL

  if (!rawUrl) {
    return null
  }

  try {
    const url = new URL(rawUrl)
    const pathname = url.pathname.replace(/\/$/, "")
    if (!/auth\/login$/i.test(pathname)) {
      url.pathname = `${pathname || ""}/auth/login`
    }
    return url
  } catch (error) {
    console.error("Invalid AUTH service URL", error)
    return null
  }
}

async function proxyLoginRequest(payload: LoginInput) {
  const targetUrl = resolveExternalLoginUrl()

  if (!targetUrl) {
    return null
  }

  let backendResponse: Response

  try {
    backendResponse = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      credentials: "include",
    })
  } catch (error) {
    console.error("Failed to contact authentication service", error)
    throw new Error("Server not reachable. Please try later.")
  }

  const rawBody = await backendResponse.text()
  let parsedBody: any = null

  if (rawBody) {
    try {
      parsedBody = JSON.parse(rawBody)
    } catch {
      parsedBody = rawBody
    }
  }

  if (!backendResponse.ok || (parsedBody && typeof parsedBody === "object" && parsedBody.success === false)) {
    const message =
      (parsedBody && typeof parsedBody === "object" && typeof parsedBody.error === "string" && parsedBody.error) ||
      (parsedBody && typeof parsedBody === "object" && typeof parsedBody.message === "string" && parsedBody.message) ||
      (typeof parsedBody === "string" && parsedBody) ||
      "Login failed. Please try again."

    const status = backendResponse.status || 502
    return NextResponse.json({ error: message }, { status })
  }

  const token =
    (parsedBody && typeof parsedBody === "object" && typeof parsedBody.token === "string" && parsedBody.token) ||
    (parsedBody &&
      typeof parsedBody === "object" &&
      parsedBody.data &&
      typeof parsedBody.data === "object" &&
      typeof (parsedBody.data as Record<string, unknown>).token === "string" &&
      ((parsedBody.data as Record<string, unknown>).token as string)) ||
    null

  const user =
    (parsedBody && typeof parsedBody === "object" && parsedBody.user && typeof parsedBody.user === "object" && parsedBody.user) ||
    (parsedBody &&
      typeof parsedBody === "object" &&
      parsedBody.data &&
      typeof parsedBody.data === "object" &&
      (parsedBody.data as Record<string, unknown>).user &&
      typeof (parsedBody.data as Record<string, unknown>).user === "object" &&
      (parsedBody.data as Record<string, unknown>).user) ||
    null

  const response = NextResponse.json({
    success: true,
    user,
    token: token ?? undefined,
  })

  if (token) {
    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: TOKEN_MAX_AGE_SECONDS,
      path: "/",
    })
  }

  return response
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = loginSchema.parse(body)

    const proxiedResponse = await proxyLoginRequest(validatedData)
    if (proxiedResponse) {
      return proxiedResponse
    }

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
      token,
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
