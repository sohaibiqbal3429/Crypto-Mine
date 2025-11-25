import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import dbConnect from "@/lib/mongodb"
import Transaction from "@/models/Transaction"
import LuckyDrawDeposit from "@/models/LuckyDrawDeposit"
import User from "@/models/User"
import Settings from "@/models/Settings"

export async function GET(request: NextRequest) {
  try {
    const session = getUserFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const adminUser = await User.findById(session.userId)
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const settingsDoc = await Settings.findOne().select({ "gating.activeMinDeposit": 1 }).lean()
    const activeDepositThreshold = settingsDoc?.gating?.activeMinDeposit ?? 80

    const [totalUsers, activeUsers, totalsAggregate, pendingDeposits, pendingWithdrawals, pendingLuckyDrawDeposits] =
      await Promise.all([
        User.estimatedDocumentCount().exec(),
        User.countDocuments({ depositTotal: { $gte: activeDepositThreshold } }).exec(),
        User.aggregate([
          {
            $group: {
            _id: null,
            totalDeposits: { $sum: "$depositTotal" },
            totalWithdrawals: { $sum: "$withdrawTotal" },
          },
        },
        { $project: { _id: 0, totalDeposits: 1, totalWithdrawals: 1 } },
        ]).exec(),
        Transaction.countDocuments({ type: "deposit", status: "pending" }).exec(),
        Transaction.countDocuments({ type: "withdraw", status: "pending" }).exec(),
        LuckyDrawDeposit.countDocuments({ status: "PENDING" }).exec(),
      ])

    return NextResponse.json({
      stats: {
        totalUsers,
        activeUsers,
        pendingDeposits,
        pendingWithdrawals,
        totalDeposits: Number(totalsAggregate?.[0]?.totalDeposits ?? 0),
        totalWithdrawals: Number(totalsAggregate?.[0]?.totalWithdrawals ?? 0),
        pendingLuckyDrawDeposits,
      },
    })
  } catch (error) {
    console.error("Admin stats error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
