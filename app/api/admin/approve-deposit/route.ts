import { type NextRequest, NextResponse } from "next/server"
import mongoose from "mongoose"

import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Balance from "@/models/Balance"
import Transaction from "@/models/Transaction"
import Notification from "@/models/Notification"
import { getUserFromRequest } from "@/lib/auth"
import { applyDepositRewards, isUserActiveFromDeposits } from "@/lib/services/rewards"
import { ACTIVE_DEPOSIT_THRESHOLD, DEPOSIT_L1_PERCENT, DEPOSIT_L2_PERCENT_ACTIVE, DEPOSIT_SELF_PERCENT_ACTIVE } from "@/lib/constants/bonuses"

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

    const pendingTransaction = await Transaction.findById(transactionId)
    if (!pendingTransaction || pendingTransaction.type !== "deposit" || pendingTransaction.status !== "pending") {
      return NextResponse.json({ error: "Invalid transaction" }, { status: 400 })
    }

    const session = await mongoose.startSession()

    let activated = false
    let depositorActive = false
    let rewardBreakdown: {
      selfBonus: number
      l1Bonus: number
      l2Bonus: number
      l1UserId: string | null
      l2UserId: string | null
    } | null = null
    let depositAmount = 0
    let userId: mongoose.Types.ObjectId | null = null
    let transactionCreatedAt: Date | null = null
    let lifetimeBefore = 0
    let lifetimeAfter = 0

    await session.withTransaction(async () => {
      const transaction = await Transaction.findById(transactionId, null, { session })
      if (!transaction || transaction.type !== "deposit" || transaction.status !== "pending") {
        throw new Error("Invalid transaction")
      }

      transaction.status = "approved"
      await transaction.save({ session })

      transactionCreatedAt = transaction.createdAt
      depositAmount = Number(transaction.amount)
      userId = transaction.userId as mongoose.Types.ObjectId

      const user = await User.findById(transaction.userId, null, { session })
      if (!user) {
        throw new Error("User not found")
      }

      lifetimeBefore = Number(user.depositTotal ?? 0)
      lifetimeAfter = lifetimeBefore + depositAmount
      const wasActive = isUserActiveFromDeposits(lifetimeBefore)
      const nowActive = isUserActiveFromDeposits(lifetimeAfter)

      user.depositTotal = lifetimeAfter
      user.isActive = nowActive
      user.status = nowActive ? "active" : "inactive"
      await user.save({ session })

      depositorActive = nowActive
      activated = !wasActive && nowActive

      await Balance.updateOne(
        { userId: transaction.userId },
        {
          $inc: {
            current: depositAmount,
            totalBalance: depositAmount,
          },
          $setOnInsert: {
            totalEarning: 0,
            staked: 0,
            pendingWithdraw: 0,
            teamRewardsAvailable: 0,
            teamRewardsClaimed: 0,
          },
        },
        { upsert: true, session },
      )

      const rewardOutcome = await applyDepositRewards(
        transaction.userId.toString(),
        depositAmount,
        {
          depositTransactionId: transaction._id.toString(),
          depositAt: transaction.createdAt,
          session,
        },
      )

      rewardBreakdown = {
        selfBonus: rewardOutcome.selfBonus,
        l1Bonus: rewardOutcome.l1Bonus,
        l2Bonus: rewardOutcome.l2Bonus,
        l1UserId: rewardOutcome.l1UserId,
        l2UserId: rewardOutcome.l2UserId,
      }

      transaction.meta = {
        ...(transaction.meta ?? {}),
        bonusBreakdown: {
          selfPercent: depositorActive ? DEPOSIT_SELF_PERCENT_ACTIVE * 100 : 0,
          l1Percent: DEPOSIT_L1_PERCENT * 100,
          l2Percent: depositorActive ? DEPOSIT_L2_PERCENT_ACTIVE * 100 : 0,
          selfAmount: rewardOutcome.selfBonus,
          l1Amount: rewardOutcome.l1Bonus,
          l2Amount: rewardOutcome.l2Bonus,
          l1UserId: rewardOutcome.l1UserId,
          l2UserId: rewardOutcome.l2UserId,
        },
        qualifiesForActivation: activated,
      }

      await transaction.save({ session })
    })

    session.endSession().catch(() => null)

    if (!userId) {
      return NextResponse.json({ error: "Invalid transaction" }, { status: 400 })
    }

    const notificationBodyParts = [
      `Your deposit of $${depositAmount.toFixed(2)} has been approved and credited to your account.`,
    ]

    if (activated) {
      notificationBodyParts.push(
        `You are now Active with lifetime deposits of $${lifetimeAfter.toFixed(2)} meeting the $${ACTIVE_DEPOSIT_THRESHOLD.toFixed(
          2,
        )} activation threshold.`,
      )
    } else if (depositorActive) {
      notificationBodyParts.push("Your account remains Active.")
    } else {
      const remaining = Math.max(0, ACTIVE_DEPOSIT_THRESHOLD - lifetimeAfter)
      notificationBodyParts.push(
        `Deposit $${remaining.toFixed(2)} more in lifetime totals to become Active and unlock bonuses.`,
      )
    }

    await Notification.create({
      userId,
      kind: "deposit-approved",
      title: "Deposit Approved",
      body: notificationBodyParts.join(" "),
    })

    return NextResponse.json({
      success: true,
      activated,
      depositorActive,
      lifetimeBefore,
      lifetimeAfter,
      rewardBreakdown,
      transactionCreatedAt: transactionCreatedAt?.toISOString() ?? null,
    })
  } catch (error) {
    console.error("Approve deposit error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
