import { NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"

export async function GET() {
  try {
    console.log("[v0] Health check starting...")

    // Test environment variables
    const mongoUri = process.env.MONGODB_URI
    const nextAuthSecret = process.env.NEXTAUTH_SECRET

    if (!mongoUri) {
      return NextResponse.json(
        {
          status: "error",
          message: "MONGODB_URI not configured",
          env: {
            mongoUri: "❌ Missing",
            nextAuthSecret: nextAuthSecret ? "✅ Set" : "❌ Missing",
          },
        },
        { status: 500 },
      )
    }

    // Test database connection
    console.log("[v0] Testing database connection...")
    await dbConnect()
    console.log("[v0] Database connected successfully")

    // Test if we can query the database
    const userCount = await User.countDocuments()
    console.log("[v0] User count:", userCount)

    // Check for initial user with referral code AAAAAA
    const initialUser = await User.findOne({ referralCode: "AAAAAA" })

    return NextResponse.json({
      status: "healthy",
      message: "All systems operational",
      database: {
        connected: true,
        userCount,
        initialUserExists: !!initialUser,
      },
      env: {
        mongoUri: "✅ Configured",
        nextAuthSecret: nextAuthSecret ? "✅ Set" : "❌ Missing",
      },
    })
  } catch (error: any) {
    console.error("[v0] Health check failed:", error)

    return NextResponse.json(
      {
        status: "error",
        message: error.message,
        database: {
          connected: false,
          error: error.message,
        },
      },
      { status: 500 },
    )
  }
}
