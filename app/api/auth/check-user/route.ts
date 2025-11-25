import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import { z } from "zod"

const checkUserSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
  })
  .refine((data) => data.email || data.phone, {
    message: "Either email or phone must be provided",
  })

export async function POST(request: NextRequest) {
  try {
    await dbConnect()

    const body = await request.json()
    const validatedData = checkUserSchema.parse(body)

    const { email, phone } = validatedData

    // Find user by email or phone
    const query: any = {}
    if (email) query.email = email
    if (phone) query.phone = phone

    const user = await User.findOne(query)

    if (!user) {
      return NextResponse.json({ error: "No account found with this email or phone number" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    })
  } catch (error: any) {
    console.error("Check user error:", error)

    if (error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
