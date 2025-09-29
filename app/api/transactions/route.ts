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
    const type = searchParams.get("type")
    const status = searchParams.get("status")
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "20")

    const query: any = { userId: userPayload.userId }
    if (type && type !== "all") query.type = type
    if (status && status !== "all") query.status = status
    if (from || to) {
      query.createdAt = {}
      if (from) query.createdAt.$gte = new Date(from)
      if (to) query.createdAt.$lte = new Date(to)
    }

    // Get transactions with enhanced selection
    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("type amount status createdAt meta")

    const total = await Transaction.countDocuments(query)

    const summary = await Transaction.aggregate([
      { $match: { userId: userPayload.userId } },
      {
        $group: {
          _id: { type: "$type", status: "$status" },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ])

    const summaryMap = summary.reduce((acc, item) => {
      const { type, status } = item._id
      if (!acc[type]) acc[type] = {}
      acc[type][status] = { total: item.total, count: item.count }
      return acc
    }, {})

    const balanceChanges = await Transaction.aggregate([
      { $match: { userId: userPayload.userId, status: "approved" } },
      {
        $group: {
          _id: null,
          totalDeposits: {
            $sum: {
              $cond: [{ $eq: ["$type", "deposit"] }, "$amount", 0],
            },
          },
          totalWithdrawals: {
            $sum: {
              $cond: [{ $eq: ["$type", "withdraw"] }, "$amount", 0],
            },
          },
          totalEarnings: {
            $sum: {
              $cond: [{ $eq: ["$type", "earn"] }, "$amount", 0],
            },
          },
          totalCommissions: {
            $sum: {
              $cond: [{ $eq: ["$type", "commission"] }, "$amount", 0],
            },
          },
        },
      },
    ])

    return NextResponse.json({
      success: true,
      transactions,
      summary: summaryMap,
      balanceChanges: balanceChanges[0] || {
        totalDeposits: 0,
        totalWithdrawals: 0,
        totalEarnings: 0,
        totalCommissions: 0,
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Transactions error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
