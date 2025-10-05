import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Balance from "@/models/Balance"
import Transaction from "@/models/Transaction"
import Notification from "@/models/Notification"
import Settings from "@/models/Settings"
import { getUserFromRequest } from "@/lib/auth"
import { withdrawSchema } from "@/lib/validations/wallet"
import { getWithdrawableBalance } from "@/lib/utils/locked-capital"

export async function POST(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const body = await request.json()
    const validatedData = withdrawSchema.parse(body)

    const [user, balanceDoc, settings] = await Promise.all([
      User.findById(userPayload.userId),
      Balance.findOne({ userId: userPayload.userId }),
      Settings.findOne(),
    ])

    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    const minWithdraw = Number(settings?.gating?.minWithdraw ?? 30)

    if (!balanceDoc) {
      return NextResponse.json(
        {
          error: "Balance information unavailable. Please contact support before requesting a withdrawal.",
        },
        { status: 400 },
      )
    }

    // Check minimum withdrawal
    if (validatedData.amount < minWithdraw) {
      return NextResponse.json(
        {
          error: `Minimum withdrawal is $${minWithdraw.toFixed(2)} USDT`,
        },
        { status: 400 },
      )
    }

    const withdrawableBalance = getWithdrawableBalance(balanceDoc, new Date())

    // Check available balance (withdrawable earnings)
    if (validatedData.amount > withdrawableBalance) {
      return NextResponse.json(
        {
          error: "Insufficient withdrawable balance",
          availableBalance: withdrawableBalance,
          requestedAmount: validatedData.amount,
        },
        { status: 400 },
      )
    }

    const updatedCurrent = balanceDoc.current - validatedData.amount
    const updatedPendingWithdraw = balanceDoc.pendingWithdraw + validatedData.amount

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
        userBalance: updatedCurrent,
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
      newBalance: updatedCurrent,
      pendingWithdraw: updatedPendingWithdraw,
    })
  } catch (error: any) {
    console.error("Withdrawal error:", error)

    if (error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
