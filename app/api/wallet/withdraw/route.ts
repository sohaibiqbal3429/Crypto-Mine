import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Balance from "@/models/Balance"
import Transaction from "@/models/Transaction"
import Notification from "@/models/Notification"
import Settings from "@/models/Settings"
import { getUserFromRequest } from "@/lib/auth"
import { withdrawSchema } from "@/lib/validations/wallet"

export async function POST(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const body = await request.json()
    const validatedData = withdrawSchema.parse(body)

    const [user, balance, settings] = await Promise.all([
      User.findById(userPayload.userId),
      Balance.findOne({ userId: userPayload.userId }),
      Settings.findOne(),
    ])

    if (!user || !balance || !settings) {
      return NextResponse.json({ error: "Data not found" }, { status: 404 })
    }

    // Check minimum withdrawal
    if (validatedData.amount < settings.gating.minWithdraw) {
      return NextResponse.json(
        {
          error: `Minimum withdrawal is $${settings.gating.minWithdraw} USDT`,
        },
        { status: 400 },
      )
    }

    // Check available balance
    if (validatedData.amount > balance.current) {
      return NextResponse.json(
        {
          error: "Insufficient balance",
          availableBalance: balance.current,
          requestedAmount: validatedData.amount,
        },
        { status: 400 },
      )
    }

    const pendingWithdrawals = await Transaction.countDocuments({
      userId: userPayload.userId,
      type: "withdraw",
      status: "pending",
    })

    if (pendingWithdrawals >= 3) {
      return NextResponse.json(
        {
          error: "You have too many pending withdrawals. Please wait for approval.",
        },
        { status: 400 },
      )
    }

    // Update balance (move to pending withdraw)
    await Balance.updateOne(
      { userId: userPayload.userId },
      {
        $inc: {
          current: -validatedData.amount,
          pendingWithdraw: validatedData.amount,
        },
      },
    )

    // Create withdrawal transaction (pending approval)
    const transaction = await Transaction.create({
      userId: userPayload.userId,
      type: "withdraw",
      amount: validatedData.amount,
      status: "pending",
      meta: {
        walletAddress: validatedData.walletAddress,
        requestedAt: new Date(),
        userBalance: balance.current,
        withdrawalFee: 0, // Could add withdrawal fees here
      },
    })

    await Notification.create({
      userId: userPayload.userId,
      kind: "withdraw-requested",
      title: "Withdrawal Requested",
      body: `Your withdrawal request of $${validatedData.amount.toFixed(2)} is pending approval.`,
    })

    return NextResponse.json({
      success: true,
      transaction: {
        id: transaction._id,
        amount: transaction.amount,
        status: transaction.status,
        createdAt: transaction.createdAt,
        walletAddress: validatedData.walletAddress,
      },
      newBalance: balance.current - validatedData.amount,
      pendingWithdraw: balance.pendingWithdraw + validatedData.amount,
    })
  } catch (error: any) {
    console.error("Withdrawal error:", error)

    if (error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
