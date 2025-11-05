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

    const { transactionId, txHash } = await request.json()

    const transaction = await Transaction.findById(transactionId)
    if (!transaction || transaction.type !== "withdraw" || transaction.status !== "pending") {
      return NextResponse.json({ error: "Invalid transaction" }, { status: 400 })
    }

    const amount = Number(transaction.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid transaction amount" }, { status: 400 })
    }

    const transactionHash = typeof txHash === "string" && txHash.trim().length > 0 ? txHash.trim() : `tx_${Date.now()}`

    await Transaction.updateOne(
      { _id: transactionId },
      {
        status: "approved",
        meta: {
          ...transaction.meta,
          approvedAt: new Date(),
          approvedBy: userPayload.userId,
          transactionHash: transactionHash,
        },
      },
    )

    // Update user withdraw total and balance
    await Promise.all([
      User.updateOne({ _id: transaction.userId }, { $inc: { withdrawTotal: amount } }),
      Balance.updateOne(
        { userId: transaction.userId },
        {
          $inc: {
            pendingWithdraw: -amount,
          },
        },
      ),
    ])

    // Create notification
    await Notification.create({
      userId: transaction.userId,
      kind: "withdraw-approved",
      title: "Withdrawal Approved",
      body: `Your withdrawal of $${amount.toFixed(2)} has been approved and processed.${transactionHash ? ` Transaction hash: ${transactionHash}` : ""}`,
    })

    return NextResponse.json({
      success: true,
      transactionHash,
    })
  } catch (error) {
    console.error("Approve withdrawal error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
