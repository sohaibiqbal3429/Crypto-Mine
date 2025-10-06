import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Balance from "@/models/Balance"
import LevelHistory from "@/models/LevelHistory"
import { getUserFromRequest } from "@/lib/auth"
import { recalculateAllUserLevels } from "@/lib/utils/commission"

export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const adminUser = await User.findById(userPayload.userId)
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const searchRaw = searchParams.get("search")
    const search = searchRaw ? searchRaw.trim() : ""
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") || "100")))

    // Build query
    const query: any = {}
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { referralCode: { $regex: search, $options: "i" } },
      ]
    }

    await recalculateAllUserLevels({ persist: true, notify: false })

    // Get users with balance data
    const users = await User.find(query)
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)

    // Get balance data for each user
    const userIds = users.map((user) => user._id)

    const [balances, levelHistoryDocs] = await Promise.all([
      Balance.find({ userId: { $in: userIds } }),
      LevelHistory.find({ userId: { $in: userIds } }).sort({ level: 1 }),
    ])

    const balanceByUser = new Map<string, any>()
    for (const balance of balances) {
      balanceByUser.set(balance.userId.toString(), balance)
    }

    const historyByUser = new Map<string, { level: number; achievedAt: string }[]>()
    for (const history of levelHistoryDocs) {
      const id = history.userId.toString()
      const list = historyByUser.get(id) ?? []
      list.push({ level: history.level, achievedAt: history.achievedAt.toISOString() })
      historyByUser.set(id, list)
    }

    const usersWithBalance = users.map((user) => {
      const balance = balanceByUser.get(user._id.toString())
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
        levelHistory: historyByUser.get(user._id.toString()) ?? [],
      }
    })

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
