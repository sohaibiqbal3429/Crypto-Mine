import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Balance from "@/models/Balance"
import { getUserFromRequest } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const adminUser = await User.findById(userPayload.userId).select("role")
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const searchRaw = searchParams.get("search")
    const search = searchRaw ? searchRaw.trim() : ""
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") || "20")))

    // Build query
    const query: any = {}
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { referralCode: { $regex: search, $options: "i" } },
      ]
    }

    // Get users with balance data
    const users = await User.find(query)
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)

    // Get balance data for each user
    const usersWithBalance = await Promise.all(
      users.map(async (user) => {
        const balance = await Balance.findOne({ userId: user._id })
        return {
          ...user.toObject(),
          balance: balance || {
            current: 0,
            totalBalance: 0,
            totalEarning: 0,
            lockedCapital: 0,
            staked: 0,
            pendingWithdraw: 0,
          },
        }
      }),
    )

    const total = await User.countDocuments(query)

    return NextResponse.json({
      users: usersWithBalance,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Admin users error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
