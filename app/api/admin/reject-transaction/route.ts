import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Balance from "@/models/Balance"
import Transaction from "@/models/Transaction"
import Notification from "@/models/Notification"
import { getUserFromRequest } from "@/lib/auth"

export async function POST(request: NextRequest) {
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

    const { transactionId, reason } = await request.json()

    const transaction = await Transaction.findById(transactionId)
    if (!transaction || transaction.status !== "pending") {
      return NextResponse.json({ error: "Invalid transaction" }, { status: 400 })
    }

    // Update transaction status
    await Transaction.updateOne({ _id: transactionId }, { status: "rejected", "meta.rejectionReason": reason })

    // If it's a withdrawal, return the amount to current balance
    if (transaction.type === "withdraw") {
      await Balance.updateOne(
        { userId: transaction.userId },
        {
          $inc: {
            current: transaction.amount,
            pendingWithdraw: -transaction.amount,
          },
        },
      )
    }

    // Create notification
    await Notification.create({
      userId: transaction.userId,
      kind: transaction.type === "deposit" ? "deposit-approved" : "withdraw-approved",
      title: `${transaction.type === "deposit" ? "Deposit" : "Withdrawal"} Rejected`,
      body: `Your ${transaction.type} of $${transaction.amount.toFixed(2)} was rejected. ${reason ? `Reason: ${reason}` : ""}`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Reject transaction error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
