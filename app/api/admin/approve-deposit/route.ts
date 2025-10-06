import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Balance from "@/models/Balance"
import Transaction from "@/models/Transaction"
import Notification from "@/models/Notification"
import { getUserFromRequest } from "@/lib/auth"
import { applyDepositRewards } from "@/lib/utils/commission"
import Settings from "@/models/Settings"
import { resolveCapitalLockWindow } from "@/lib/utils/locked-capital"

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

    const { transactionId } = await request.json()

    const [transaction, settings] = await Promise.all([
      Transaction.findById(transactionId),
      Settings.findOne(),
    ])
    if (!transaction || transaction.type !== "deposit" || transaction.status !== "pending") {
      return NextResponse.json({ error: "Invalid transaction" }, { status: 400 })
    }

    const { lockStart, lockEnd } = resolveCapitalLockWindow(settings)

    const lockMeta = {
      amount: transaction.amount,
      lockStart,
      lockEnd,
    }

    // Update transaction status
    await Transaction.updateOne(
      { _id: transactionId },
      { status: "approved", $set: { "meta.lock": lockMeta } },
    )

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
          $push: {
            lockedCapitalLots: {
              amount: transaction.amount,
              lockStart,
              lockEnd,
              sourceTransactionId: transaction._id,
            },
          },
          $setOnInsert: {
            totalEarning: 0,
            staked: 0,
            pendingWithdraw: 0,
            teamRewardsAvailable: 0,
            teamRewardsClaimed: 0,
          },
        },
        { upsert: true },
      ),
    ])

    // Apply deposit commissions and referral rewards
    const rewardOutcome = await applyDepositRewards(
      transaction.userId.toString(),
      transaction.amount,
      {
        depositTransactionId: transaction._id.toString(),
        depositAt: transaction.createdAt,
      },
    )

    if (rewardOutcome.activated) {
      await Transaction.updateOne(
        { _id: transactionId },
        { $set: { "meta.qualifiesForActivation": true } },
      )
    }

    // Create notification
    const notificationBodyParts = [
      `Your deposit of $${transaction.amount.toFixed(2)} has been approved and credited to your account.`,
    ]

    if (rewardOutcome.activated) {
      notificationBodyParts.push(
        `You've now satisfied the qualifying deposit requirement of $${rewardOutcome.activationThreshold.toFixed(
          2,
        )} and your account is fully activated.`,
      )
    }

    await Notification.create({
      userId: transaction.userId,
      kind: "deposit-approved",
      title: "Deposit Approved",
      body: notificationBodyParts.join(" "),
    })

    return NextResponse.json({ success: true, activated: rewardOutcome.activated })
  } catch (error) {
    console.error("Approve deposit error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
