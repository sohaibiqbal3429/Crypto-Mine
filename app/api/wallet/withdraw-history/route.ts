import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import Transaction from "@/models/Transaction"
import { getUserFromRequest } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "10")
    const skip = (page - 1) * limit

    const withdrawals = await Transaction.find({
      userId: userPayload.userId,
      type: "withdraw",
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("amount status createdAt meta")

    const totalWithdrawals = await Transaction.countDocuments({
      userId: userPayload.userId,
      type: "withdraw",
    })

    const withdrawalStats = await Transaction.aggregate([
      {
        $match: {
          userId: userPayload.userId,
          type: "withdraw",
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ])

    return NextResponse.json({
      success: true,
      withdrawals,
      pagination: {
        page,
        limit,
        total: totalWithdrawals,
        pages: Math.ceil(totalWithdrawals / limit),
      },
      stats: withdrawalStats.reduce((acc, stat) => {
        acc[stat._id] = {
          count: stat.count,
          totalAmount: stat.totalAmount,
        }
        return acc
      }, {}),
    })
  } catch (error) {
    console.error("Withdrawal history error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
