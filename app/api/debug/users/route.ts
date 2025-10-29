import { NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Balance from "@/models/Balance"
import { hashPassword } from "@/lib/auth"

export async function GET() {
  try {
    await dbConnect()

    // Get all users
    const users = await User.find({}, { passwordHash: 0 }).lean()

    return NextResponse.json({
      success: true,
      totalUsers: users.length,
      users: users,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST() {
  try {
    await dbConnect()

    // Check if initial user already exists
    const existingUser = await User.findOne({ referralCode: "AAAAAA" })
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

    // Create initial admin user
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

    // Create balance for initial user
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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
