import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Balance from "@/models/Balance"
import Transaction from "@/models/Transaction"
import Notification from "@/models/Notification"
import { getUserFromRequest } from "@/lib/auth"
import { applyDepositRewards } from "@/lib/utils/commission"
import { ensureUserActivationForDeposit } from "@/lib/utils/policy"

export async function POST(request: NextRequest) {
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

    const { transactionId } = await request.json()

    const transaction = await Transaction.findById(transactionId)
    if (!transaction || transaction.type !== "deposit" || transaction.status !== "pending") {
      return NextResponse.json({ error: "Invalid transaction" }, { status: 400 })
    }

    const user = await User.findById(transaction.userId).select(
      "isActive referredBy first_qualifying_deposit_at first_qualifying_deposit_amount",
    )
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Update transaction status
    await Transaction.updateOne({ _id: transactionId }, { status: "approved" })

    // Update user deposit total and balance
    await Promise.all([
      User.updateOne({ _id: transaction.userId }, { $inc: { depositTotal: transaction.amount } }),
      Balance.updateOne(
        { userId: transaction.userId },
        {
          $inc: {
            current: transaction.amount,
            totalBalance: transaction.amount,
            lockedCapital: transaction.amount,
          },
        },
      ),
    ])

    await ensureUserActivationForDeposit({
      userId: transaction.userId.toString(),
      userDoc: user,
      depositAmount: transaction.amount,
      meta: transaction.meta,
      occurredAt: transaction.createdAt ?? new Date(),
    })

    // Apply deposit commissions and referral rewards
    await applyDepositRewards(transaction.userId.toString(), transaction.amount)

    // Create notification
    await Notification.create({
      userId: transaction.userId,
      kind: "deposit-approved",
      title: "Deposit Approved",
      body: `Your deposit of $${transaction.amount.toFixed(2)} has been approved and credited to your account.`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Approve deposit error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
