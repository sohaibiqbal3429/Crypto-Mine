import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Balance from "@/models/Balance"
import Transaction from "@/models/Transaction"
import { getUserFromRequest } from "@/lib/auth"
import { getWithdrawableBalance } from "@/lib/utils/locked-capital"

export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const user = await User.findById(userPayload.userId)
    let balance = await Balance.findOne({ userId: user._id })

    // Create balance if it doesn't exist
    if (!balance) {
      balance = await Balance.create({
        userId: user._id,
        current: 0,
        totalBalance: 0,
        totalEarning: 0,
        lockedCapital: 0,
        lockedCapitalLots: [],
        staked: 0,
        pendingWithdraw: 0,
      })
    }

    // Get recent transactions
    const transactions = await Transaction.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("type amount status createdAt meta")

    const withdrawableBalance = getWithdrawableBalance(balance, new Date())

    return NextResponse.json({
      success: true,
      balance: {
        current: balance.current,
        totalBalance: balance.totalBalance,
        totalEarning: balance.totalEarning,
        lockedCapital: balance.lockedCapital,
        lockedCapitalLots: balance.lockedCapitalLots,
        staked: balance.staked,
        pendingWithdraw: balance.pendingWithdraw,
      },
      withdrawableBalance,
      userStats: {
        depositTotal: user.depositTotal,
        withdrawTotal: user.withdrawTotal,
        roiEarnedTotal: user.roiEarnedTotal,
        level: user.level,
      },
      recentTransactions: transactions,
    })
  } catch (error) {
    console.error("Get balance error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
