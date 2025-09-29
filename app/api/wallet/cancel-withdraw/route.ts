import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
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

    const { transactionId } = await request.json()

    const transaction = await Transaction.findOne({
      _id: transactionId,
      userId: userPayload.userId,
      type: "withdraw",
      status: "pending",
    })

    if (!transaction) {
      return NextResponse.json(
        {
          error: "Transaction not found or cannot be cancelled",
        },
        { status: 400 },
      )
    }

    // Update transaction status to cancelled
    await Transaction.updateOne(
      { _id: transactionId },
      {
        status: "cancelled",
        meta: {
          ...transaction.meta,
          cancelledAt: new Date(),
          cancelledBy: "user",
        },
      },
    )

    // Return funds to current balance
    await Balance.updateOne(
      { userId: userPayload.userId },
      {
        $inc: {
          current: transaction.amount,
          pendingWithdraw: -transaction.amount,
        },
      },
    )

    // Create notification
    await Notification.create({
      userId: userPayload.userId,
      kind: "withdraw-cancelled",
      title: "Withdrawal Cancelled",
      body: `Your withdrawal of $${transaction.amount.toFixed(2)} has been cancelled and funds returned to your balance.`,
    })

    return NextResponse.json({
      success: true,
      message: "Withdrawal cancelled successfully",
      refundedAmount: transaction.amount,
    })
  } catch (error) {
    console.error("Cancel withdrawal error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
