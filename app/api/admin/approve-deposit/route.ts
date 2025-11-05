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
import { isTransactionNotSupportedError } from "@/lib/utils/mongo-errors"

class InvalidTransactionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvalidTransactionError"
  }
}

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

    const body = (await request.json().catch(() => null)) as
      | {
          transactionId?: unknown
        }
      | null

    const transactionId = typeof body?.transactionId === "string" ? body.transactionId.trim() : ""
    if (!transactionId) {
      return NextResponse.json({ error: "Transaction ID is required" }, { status: 400 })
    }

    const pendingTransaction = await Transaction.findById(transactionId)
    if (!pendingTransaction || pendingTransaction.type !== "deposit" || pendingTransaction.status !== "pending") {
      return NextResponse.json({ error: "Invalid transaction" }, { status: 400 })
    }

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

    const processApproval = async (session: mongoose.ClientSession | null) => {
      const sessionOptions = session ? { session } : undefined
      const transaction = await Transaction.findById(transactionId, null, sessionOptions)
      if (!transaction || transaction.type !== "deposit" || transaction.status !== "pending") {
        throw new InvalidTransactionError("Invalid transaction")
      }

      transaction.status = "approved"
      if (session) {
        await transaction.save({ session })
      } else {
        await transaction.save()
      }

      transactionCreatedAt = transaction.createdAt ?? null
      depositAmount = Number(transaction.amount ?? 0)
      if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
        throw new InvalidTransactionError("Invalid deposit amount")
      }

      const rawTransactionUserId = transaction.userId
      if (!rawTransactionUserId) {
        throw new InvalidTransactionError("Transaction user missing")
      }

      const normalizedTransactionUserId =
        rawTransactionUserId instanceof mongoose.Types.ObjectId
          ? rawTransactionUserId
          : mongoose.Types.ObjectId.isValid(String(rawTransactionUserId))
            ? new mongoose.Types.ObjectId(String(rawTransactionUserId))
            : null

      const userLookupId = normalizedTransactionUserId
        ? normalizedTransactionUserId.toHexString()
        : String(rawTransactionUserId)
      const user = await User.findById(userLookupId, null, sessionOptions)
      if (!user) {
        throw new InvalidTransactionError("User not found")
      }

      const resolvedUserId =
        normalizedTransactionUserId ??
        (user._id instanceof mongoose.Types.ObjectId
          ? user._id
          : mongoose.Types.ObjectId.isValid(String(user._id))
            ? new mongoose.Types.ObjectId(String(user._id))
            : null)

      if (!resolvedUserId) {
        throw new InvalidTransactionError("User has invalid identifier")
      }

      userId = resolvedUserId

      lifetimeBefore = Number(user.depositTotal ?? 0)
      lifetimeAfter = lifetimeBefore + depositAmount
      const wasActive = isUserActiveFromDeposits(lifetimeBefore)
      const nowActive = isUserActiveFromDeposits(lifetimeAfter)

      user.depositTotal = lifetimeAfter
      user.isActive = nowActive
      user.status = nowActive ? "active" : "inactive"
      if (session) {
        await user.save({ session })
      } else {
        await user.save()
      }

      depositorActive = nowActive
      activated = !wasActive && nowActive

      const balanceOptions = session ? { upsert: true, session } : { upsert: true }
      await Balance.updateOne(
        { userId: resolvedUserId },
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
        balanceOptions,
      )

      const rewardOptions = {
        depositTransactionId:
          transaction._id instanceof mongoose.Types.ObjectId
            ? transaction._id.toHexString()
            : String(transaction._id ?? transactionId),
        depositAt: transaction.createdAt ?? new Date(),
      } as const

      const rewardOutcome = await applyDepositRewards(
        resolvedUserId.toHexString(),
        depositAmount,
        session ? { ...rewardOptions, session } : { ...rewardOptions, transactional: false },
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

      if (session) {
        await transaction.save({ session })
      } else {
        await transaction.save()
      }
    }

    let session: mongoose.ClientSession | null = null
    try {
      session = await mongoose.startSession()
    } catch (error) {
      if (!isTransactionNotSupportedError(error)) {
        throw error
      }
      session = null
    }

    if (session) {
      try {
        await session.withTransaction(async () => {
          await processApproval(session)
        })
      } catch (error) {
        if (isTransactionNotSupportedError(error)) {
          await processApproval(null)
        } else {
          throw error
        }
      } finally {
        session.endSession().catch(() => null)
      }
    } else {
      await processApproval(null)
    }

    if (!userId) {
      throw new InvalidTransactionError("Invalid transaction")
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

    const transactionCreatedAtIso = transactionCreatedAt ? (transactionCreatedAt as Date).toISOString() : null

    return NextResponse.json({
      success: true,
      activated,
      depositorActive,
      lifetimeBefore,
      lifetimeAfter,
      rewardBreakdown,
      transactionCreatedAt: transactionCreatedAtIso,
    })
  } catch (error) {
    if (error instanceof InvalidTransactionError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error("Approve deposit error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
