import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { getUserFromRequest } from "@/lib/auth"
import dbConnect from "@/lib/mongodb"
import { serializeUser } from "@/lib/serializers/user"
import { formatPhoneNumber, validatePhoneNumber } from "@/lib/utils/otp"
import { PROFILE_AVATAR_VALUES } from "@/lib/constants/avatars"
import User from "@/models/User"

const profileUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Name is too long"),
  phone: z.string().trim().min(1, "Phone number is required"),
  avatar: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || PROFILE_AVATAR_VALUES.includes(value), {
      message: "Select a valid avatar option",
    }),
})

export async function PATCH(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const parsedBody = profileUpdateSchema.parse(await request.json())

    const formattedPhone = formatPhoneNumber(parsedBody.phone)
    const validation = validatePhoneNumber(formattedPhone)
    if (!validation.isValid) {
      return NextResponse.json({ error: "Please enter a valid international phone number" }, { status: 400 })
    }

    await dbConnect()

    const user = await User.findById(userPayload.userId)
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const phoneInUse = await User.findOne({
      _id: { $ne: user._id },
      phone: formattedPhone,
    })

    if (phoneInUse) {
      return NextResponse.json({ error: "This phone number is already linked to another account" }, { status: 400 })
    }

    const phoneChanged = user.phone !== formattedPhone

    user.name = parsedBody.name
    user.phone = formattedPhone
    if (parsedBody.avatar) {
      user.profileAvatar = parsedBody.avatar
    }

    if (phoneChanged) {
      user.phoneVerified = false
    }

    await user.save()

    const responseMessage = phoneChanged
      ? "Profile updated. Please verify your phone number to complete profile verification."
      : "Profile updated successfully."

    return NextResponse.json({
      message: responseMessage,
      user: serializeUser(user),
    })
  } catch (error) {
    console.error("Profile update error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message ?? "Invalid input" }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
  }
}
