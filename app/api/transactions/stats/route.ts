import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import Transaction from "@/models/Transaction"
import Balance from "@/models/Balance"
import User from "@/models/User"
import { getUserFromRequest } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const { searchParams } = new URL(request.url)
    const period = searchParams.get("period") || "30" // days

    const periodStart = new Date()
    periodStart.setDate(periodStart.getDate() - Number.parseInt(period))

    // Get user data
    const [user, balance] = await Promise.all([
      User.findById(userPayload.userId),
      Balance.findOne({ userId: userPayload.userId }),
    ])

    if (!user || !balance) {
      return NextResponse.json({ error: "User data not found" }, { status: 404 })
    }

    // Transaction statistics for the period
    const periodStats = await Transaction.aggregate([
      {
        $match: {
          userId: userPayload.userId,
          createdAt: { $gte: periodStart },
        },
      },
      {
        $group: {
          _id: {
            type: "$type",
            status: "$status",
            date: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
              },
            },
          },
          count: { $sum: 1 },
          amount: { $sum: "$amount" },
        },
      },
      {
        $sort: { "_id.date": 1 },
      },
    ])

    // Mining performance over time
    const miningStats = await Transaction.aggregate([
      {
        $match: {
          userId: userPayload.userId,
          type: "earn",
          "meta.source": "mining",
          createdAt: { $gte: periodStart },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
            },
          },
          earnings: { $sum: "$amount" },
          count: { $sum: 1 },
          avgProfit: { $avg: "$amount" },
          maxProfit: { $max: "$amount" },
          minProfit: { $min: "$amount" },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ])

    // Recent activity summary
    const recentActivity = await Transaction.find({
      userId: userPayload.userId,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("type amount status createdAt meta")

    // Pending transactions
    const pendingTransactions = await Transaction.find({
      userId: userPayload.userId,
      status: "pending",
    }).select("type amount createdAt meta")

    return NextResponse.json({
      success: true,
      userStats: {
        depositTotal: user.depositTotal,
        withdrawTotal: user.withdrawTotal,
        roiEarnedTotal: user.roiEarnedTotal,
        currentBalance: balance.current,
        totalBalance: balance.totalBalance,
        totalEarning: balance.totalEarning,
        lockedCapital: 0,
        pendingWithdraw: balance.pendingWithdraw,
      },
      periodStats,
      miningStats,
      recentActivity,
      pendingTransactions,
      period: Number.parseInt(period),
    })
  } catch (error) {
    console.error("Transaction stats error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
