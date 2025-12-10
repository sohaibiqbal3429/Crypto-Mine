import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Balance from "@/models/Balance"
import Transaction from "@/models/Transaction"
import Notification from "@/models/Notification"
import Settings from "@/models/Settings"
import { getUserFromRequest } from "@/lib/auth"
import { withdrawSchema } from "@/lib/validations/wallet"
import { calculateWithdrawableSnapshot, normaliseAmount } from "@/lib/utils/locked-capital"
import { emitAuditLog } from "@/lib/observability/audit"
import { incrementCounter } from "@/lib/observability/metrics"

const MAX_PENDING_WITHDRAWALS = 3

function resolveAmountBucket(amount: number): string {
  if (amount >= 1000) return "1000_plus"
  if (amount >= 500) return "500_999"
  if (amount >= 100) return "100_499"
  return "under_100"
}

export async function POST(request: NextRequest) {
  const now = new Date()

  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const body = await request.json()
    const validatedData = withdrawSchema.parse(body)
    const requestAmount = normaliseAmount(validatedData.amount)
    const source = validatedData.source ?? "main"

    const [user, balanceDoc, settings] = await Promise.all([
      User.findById(userPayload.userId),
      Balance.findOne({ userId: userPayload.userId }),
      Settings.findOne(),
    ])

    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    if (user.isBlocked) {
      return NextResponse.json({ error: "Account blocked", blocked: true }, { status: 403 })
    }

    if (!balanceDoc) {
      return NextResponse.json(
        {
          error: "Balance information unavailable. Please contact support before requesting a withdrawal.",
        },
        { status: 400 },
      )
    }

    const minWithdraw = normaliseAmount(Number(settings?.gating?.minWithdraw ?? 30))

    if (requestAmount < minWithdraw) {
      incrementCounter("wallet.withdraw.request_rejected", 1, {
        reason: "below_minimum",
        bucket: resolveAmountBucket(requestAmount),
      })
      return NextResponse.json(
        {
          error: `Minimum withdrawal is $${minWithdraw.toFixed(2)} USDT`,
          code: "MIN_WITHDRAW_NOT_MET",
          context: {
            requestedAmount: requestAmount,
            minimum: minWithdraw,
          },
        },
        { status: 400 },
      )
    }

    const withdrawableSnapshot = calculateWithdrawableSnapshot(balanceDoc, now)
    const earningsBalance = normaliseAmount(balanceDoc.totalEarning ?? 0)
    const selectedBalance =
      source === "earnings"
        ? Math.min(earningsBalance, withdrawableSnapshot.withdrawable)
        : withdrawableSnapshot.withdrawable

    incrementCounter("wallet.withdraw.request_attempt", 1, {
      bucket: resolveAmountBucket(requestAmount),
      source,
    })

    if (requestAmount > selectedBalance) {
      incrementCounter("wallet.withdraw.request_rejected", 1, {
        reason: "insufficient_selected_balance",
        source,
      })

      return NextResponse.json(
        {
          error: "Withdrawal amount cannot exceed your selected balance.",
          code: "SELECTED_BALANCE_INSUFFICIENT",
          context: { requestedAmount: requestAmount, selectedBalance, source },
        },
        { status: 400 },
      )
    }

    if (requestAmount > withdrawableSnapshot.withdrawable) {
      const shortageCents = Math.max(
        0,
        Math.round(requestAmount * 100) - withdrawableSnapshot.withdrawableCents,
      )
      const shortage = normaliseAmount(shortageCents / 100)
      const reasons: string[] = []

      if (withdrawableSnapshot.pendingWithdraw > 0) {
        reasons.push(`$${withdrawableSnapshot.pendingWithdraw.toFixed(2)} is already pending approval.`)
      }

      const messageParts = [
        `Requested $${requestAmount.toFixed(2)} but only $${withdrawableSnapshot.withdrawable.toFixed(2)} is withdrawable right now.`,
      ]

      if (reasons.length) {
        messageParts.push(reasons.join(" "))
      }

      incrementCounter("wallet.withdraw.request_rejected", 1, {
        reason: "insufficient_withdrawable",
        bucket: resolveAmountBucket(requestAmount),
        source,
      })

      emitAuditLog({
        event: "withdrawal_request_rejected",
        actorId: userPayload.userId,
        metadata: {
          requestedAmount: requestAmount,
          withdrawable: withdrawableSnapshot.withdrawable,
          pendingWithdraw: withdrawableSnapshot.pendingWithdraw,
          shortage,
          source,
          selectedBalance,
        },
      })

      return NextResponse.json(
        {
          error: messageParts.join(" "),
          code: "INSUFFICIENT_WITHDRAWABLE_BALANCE",
          context: {
            requestedAmount: requestAmount,
            withdrawable: withdrawableSnapshot.withdrawable,
            pendingWithdraw: withdrawableSnapshot.pendingWithdraw,
            shortage,
          },
        },
        { status: 400 },
      )
    }

    const pendingWithdrawals = await Transaction.countDocuments({
      userId: userPayload.userId,
      type: "withdraw",
      status: "pending",
    })

    if (pendingWithdrawals >= MAX_PENDING_WITHDRAWALS) {
      incrementCounter("wallet.withdraw.request_rejected", 1, {
        reason: "too_many_pending",
        source,
      })

      return NextResponse.json(
        {
          error: `You already have ${pendingWithdrawals} pending withdrawals. Please wait for approval before requesting another.`,
          code: "PENDING_LIMIT_REACHED",
          context: {
            pendingWithdrawals,
            maxPending: MAX_PENDING_WITHDRAWALS,
          },
        },
        { status: 400 },
      )
    }

    const guardCurrent = normaliseAmount(requestAmount)

    const updateResult = await Balance.updateOne(
      {
        userId: userPayload.userId,
        current: { $gte: guardCurrent },
      },
      {
        $inc: {
          current: -requestAmount,
          pendingWithdraw: requestAmount,
        },
      },
    )

    if (updateResult.modifiedCount === 0) {
      const freshBalance = await Balance.findOne({ userId: userPayload.userId })
      const refreshedSnapshot = freshBalance ? calculateWithdrawableSnapshot(freshBalance, now) : null

      incrementCounter("wallet.withdraw.request_rejected", 1, {
        reason: "stale_balance",
      })

      emitAuditLog({
        event: "withdrawal_request_conflict",
        actorId: userPayload.userId,
        metadata: {
          requestedAmount: requestAmount,
          withdrawable: refreshedSnapshot?.withdrawable ?? 0,
          source,
        },
        severity: "warn",
      })

      return NextResponse.json(
        {
          error: `Your balance changed while processing the withdrawal. You can withdraw up to $${(refreshedSnapshot?.withdrawable ?? 0).toFixed(2)} right now.`,
          code: "BALANCE_CHANGED",
          context: {
            requestedAmount: requestAmount,
            withdrawable: refreshedSnapshot?.withdrawable ?? 0,
            source,
          },
        },
        { status: 409 },
      )
    }

    const refreshedBalance = await Balance.findOne({ userId: userPayload.userId })
    if (!refreshedBalance) {
      throw new Error("Balance missing after withdrawal update")
    }

    const refreshedSnapshot = calculateWithdrawableSnapshot(refreshedBalance, now)

    const transaction = await Transaction.create({
      userId: userPayload.userId,
      type: "withdraw",
      amount: requestAmount,
      status: "pending",
      meta: {
        walletAddress: validatedData.walletAddress,
        requestedAt: now,
        userBalance: refreshedSnapshot.current,
        withdrawableAfterRequest: refreshedSnapshot.withdrawable,
        withdrawalFee: 0,
        source,
      },
    })

    await Notification.create({
      userId: userPayload.userId,
      kind: "withdraw-requested",
      title: "Withdrawal Requested",
      body: `Your withdrawal request of $${requestAmount.toFixed(2)} is pending approval.`,
    })

    incrementCounter("wallet.withdraw.request_success", 1, {
      bucket: resolveAmountBucket(requestAmount),
      source,
    })

    emitAuditLog({
      event: "withdrawal_request_submitted",
      actorId: userPayload.userId,
      metadata: {
        requestedAmount: requestAmount,
        pendingWithdraw: refreshedSnapshot.pendingWithdraw,
        withdrawableAfterRequest: refreshedSnapshot.withdrawable,
        source,
      },
    })

    return NextResponse.json({
      success: true,
      transaction: {
        id: transaction._id,
        amount: transaction.amount,
        status: transaction.status,
        createdAt: transaction.createdAt,
        walletAddress: validatedData.walletAddress,
        source,
      },
      newBalance: refreshedSnapshot.current,
      pendingWithdraw: refreshedSnapshot.pendingWithdraw,
      withdrawableBalance: refreshedSnapshot.withdrawable,
    })
  } catch (error: any) {
    console.error("Withdrawal error:", error)

    if (error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 })
    }

    incrementCounter("wallet.withdraw.request_failed", 1, {
      reason: error?.code ?? "unknown",
    })

    emitAuditLog({
      event: "withdrawal_request_error",
      severity: "error",
      metadata: {
        message: error?.message,
      },
    })

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
