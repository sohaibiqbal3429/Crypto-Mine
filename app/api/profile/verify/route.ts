import { NextResponse, type NextRequest } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import dbConnect from "@/lib/mongodb"
import { serializeUser } from "@/lib/serializers/user"
import { formatPhoneNumber, validatePhoneNumber } from "@/lib/utils/otp"
import User from "@/models/User"

export async function POST(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const user = await User.findById(userPayload.userId)
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (!user.phone) {
      return NextResponse.json({ error: "Add a phone number to your profile before verifying." }, { status: 400 })
    }

    const formattedPhone = formatPhoneNumber(user.phone)
    const validation = validatePhoneNumber(formattedPhone)

    if (!validation.isValid) {
      return NextResponse.json({ error: "Update your profile with a valid phone number before verifying." }, { status: 400 })
    }

    user.phone = formattedPhone

    if (user.phoneVerified) {
      return NextResponse.json({
        message: "Your profile is already verified.",
        user: serializeUser(user),
      })
    }

    user.phoneVerified = true

    await user.save()

    return NextResponse.json({
      message: "Profile verified successfully.",
      user: serializeUser(user),
    })
  } catch (error) {
    console.error("Profile verification error:", error)
    return NextResponse.json({ error: "Failed to verify profile" }, { status: 500 })
  }
}
