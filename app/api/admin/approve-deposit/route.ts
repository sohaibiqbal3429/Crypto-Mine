import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Balance from "@/models/Balance"
import Transaction from "@/models/Transaction"
import Notification from "@/models/Notification"
import { getUserFromRequest } from "@/lib/auth"
import { processReferralCommission } from "@/lib/utils/commission"

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

    // Process referral commission
    await processReferralCommission(transaction.userId.toString(), transaction.amount)

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
