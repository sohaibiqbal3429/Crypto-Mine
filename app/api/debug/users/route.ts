import { NextResponse } from "next/server"

import dbConnect from "@/lib/mongodb"
import { isTimeoutError, withRequestTiming } from "@/lib/observability/timing"
import User from "@/models/User"
import Balance from "@/models/Balance"
import { hashPassword } from "@/lib/auth"

const QUERY_TIMEOUT_MS = Number(process.env.DEBUG_QUERY_TIMEOUT_MS || 2000)

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Debug endpoint disabled" }, { status: 404 })
  }

  return withRequestTiming("api.debug.users.get", async () => {
    try {
      await dbConnect()

      const users = await User.find({}, { passwordHash: 0 })
        .maxTimeMS(QUERY_TIMEOUT_MS)
        .limit(200)
        .lean()

      return NextResponse.json({
        success: true,
        totalUsers: users.length,
        users,
      })
    } catch (error: any) {
      if (isTimeoutError(error)) {
        return NextResponse.json({ error: "Debug users query timed out" }, { status: 504 })
      }

      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  })
}

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Debug endpoint disabled" }, { status: 404 })
  }

  return withRequestTiming("api.debug.users.post", async () => {
    try {
      await dbConnect()

      const existingUser = await User.findOne({ referralCode: "AAAAAA" })
        .maxTimeMS(QUERY_TIMEOUT_MS)
        .lean()
      if (existingUser) {
        return NextResponse.json({
          success: true,
          message: "Initial user already exists",
          user: {
            id: existingUser._id,
            name: existingUser.name,
            email: existingUser.email,
            referralCode: existingUser.referralCode,
          },
        })
      }

      const passwordHash = await hashPassword("Coin4$")

      const initialUser = await User.create({
        name: "Admin User",
        email: "admin@cryptomining.com",
        passwordHash,
        referralCode: "AAAAAA",
        role: "admin",
        isActive: true,
        qualified: true,
        qualifiedAt: new Date(),
      })

      await Balance.create({
        userId: initialUser._id,
      })

      return NextResponse.json({
        success: true,
        message: "Initial user created successfully",
        user: {
          id: initialUser._id,
          name: initialUser.name,
          email: initialUser.email,
          referralCode: initialUser.referralCode,
        },
      })
    } catch (error: any) {
      if (isTimeoutError(error)) {
        return NextResponse.json({ error: "Debug user creation timed out" }, { status: 504 })
      }

      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  })
}
