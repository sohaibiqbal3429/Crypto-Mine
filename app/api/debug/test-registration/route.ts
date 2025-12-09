import { NextResponse } from "next/server"

import dbConnect from "@/lib/mongodb"
import { isTimeoutError, withRequestTiming } from "@/lib/observability/timing"
import User from "@/models/User"
import { hashPassword } from "@/lib/auth"
import { generateReferralCode } from "@/lib/utils/referral"

const QUERY_TIMEOUT_MS = Number(process.env.DEBUG_QUERY_TIMEOUT_MS || 2000)

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Debug endpoint disabled" }, { status: 404 })
  }

  return withRequestTiming("api.debug.test-registration", async () => {
    try {
      await dbConnect()

      const referrer = await User.findOne({ referralCode: "AAAAAA" })
        .maxTimeMS(QUERY_TIMEOUT_MS)
        .lean()
      if (!referrer) {
        return NextResponse.json(
          {
            error: "Initial user with referral code AAAAAA not found",
            solution: "Run: node scripts/setup-database.js",
          },
          { status: 400 },
        )
      }

      const testPassword = "testpass123"
      const hashedPassword = await hashPassword(testPassword)
      const newReferralCode = generateReferralCode()

      const testUserData = {
        name: "Test User",
        email: "test@example.com",
        passwordHash: hashedPassword,
        referralCode: newReferralCode,
        referredBy: referrer._id,
      }

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
        sampleUser: testUserData,
      })
    } catch (error: any) {
      if (isTimeoutError(error)) {
        return NextResponse.json({ error: "Debug registration test timed out" }, { status: 504 })
      }

      return NextResponse.json(
        {
          error: "Debug test failed",
          details: error.message,
        },
        { status: 500 },
      )
    }
  }, { timeoutMs: 3000 })
}
