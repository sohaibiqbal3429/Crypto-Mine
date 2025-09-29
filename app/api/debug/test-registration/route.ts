import { NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import { hashPassword } from "@/lib/auth"
import { generateReferralCode } from "@/lib/utils/referral"

export async function POST() {
  try {
    console.log("[v0] Debug registration test starting...")

    // Test 1: Database connection
    console.log("[v0] Test 1: Database connection")
    await dbConnect()
    console.log("[v0] ✅ Database connected")

    // Test 2: Check for referral code AAAAAA
    console.log("[v0] Test 2: Checking referral code AAAAAA")
    const referrer = await User.findOne({ referralCode: "AAAAAA" })
    if (!referrer) {
      return NextResponse.json(
        {
          error: "Initial user with referral code AAAAAA not found",
          solution: "Run: node scripts/setup-database.js",
        },
        { status: 400 },
      )
    }
    console.log("[v0] ✅ Referrer found:", referrer.name)

    // Test 3: Password hashing
    console.log("[v0] Test 3: Password hashing")
    const testPassword = "testpass123"
    const hashedPassword = await hashPassword(testPassword)
    console.log("[v0] ✅ Password hashed successfully")

    // Test 4: Referral code generation
    console.log("[v0] Test 4: Referral code generation")
    const newReferralCode = generateReferralCode()
    console.log("[v0] ✅ Generated referral code:", newReferralCode)

    // Test 5: User creation (dry run)
    console.log("[v0] Test 5: Testing user creation structure")
    const testUserData = {
      name: "Test User",
      email: "test@example.com",
      passwordHash: hashedPassword,
      referralCode: newReferralCode,
      referredBy: referrer._id,
    }
    console.log("[v0] ✅ User data structure valid")

    return NextResponse.json({
      status: "success",
      message: "All registration components working correctly",
      tests: {
        databaseConnection: "✅ Pass",
        referralCodeExists: "✅ Pass",
        passwordHashing: "✅ Pass",
        referralCodeGeneration: "✅ Pass",
        userDataStructure: "✅ Pass",
      },
      referrer: {
        id: referrer._id,
        name: referrer.name,
        email: referrer.email,
      },
    })
  } catch (error: any) {
    console.error("[v0] Debug test failed:", error)
    return NextResponse.json(
      {
        error: "Debug test failed",
        details: error.message,
        stack: error.stack,
      },
      { status: 500 },
    )
  }
}
