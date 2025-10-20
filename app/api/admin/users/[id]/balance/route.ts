import mongoose from "mongoose"
import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import dbConnect from "@/lib/mongodb"
import Balance from "@/models/Balance"
import User from "@/models/User"
import Transaction from "@/models/Transaction"
import Notification from "@/models/Notification"
import { emitAuditLog } from "@/lib/observability/audit"

interface RouteParams {
  params: {
    id: string
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const actingUser = getUserFromRequest(request)
    if (!actingUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!params?.id || !mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const direction = body.direction === "debit" ? "debit" : "credit"
    const amount = Number.parseFloat(body.amount as string)
    const reason = typeof body.reason === "string" ? body.reason.trim() : ""

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 })
    }

    if (!reason) {
      return NextResponse.json({ error: "Reason is required" }, { status: 400 })
    }

    await dbConnect()

    const adminUser = await User.findById(actingUser.userId)
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const balanceDoc = await Balance.findOne({ userId: params.id })
    if (!balanceDoc) {
      return NextResponse.json({ error: "Balance not found" }, { status: 404 })
    }

    const update: Record<string, unknown> = {}
    const increment: Record<string, number> = {}

    if (direction === "credit") {
      increment.current = amount
      increment.totalBalance = amount
      increment.totalEarning = amount
    } else {
      if (amount > (balanceDoc.current ?? 0)) {
        return NextResponse.json(
          {
            error: "Insufficient balance to debit",
            currentBalance: balanceDoc.current ?? 0,
            requestedAmount: amount,
          },
          { status: 400 },
        )
      }

      increment.current = -amount
      increment.totalBalance = -Math.min(amount, balanceDoc.totalBalance ?? 0)
    }

    if (Object.keys(increment).length > 0) {
      update.$inc = increment
    }

    await Balance.updateOne({ userId: params.id }, update)

    await Transaction.create({
      userId: params.id,
      type: "adjust",
      amount: direction === "credit" ? amount : -amount,
      status: "approved",
      meta: {
        reason,
        adjustmentType: direction,
        adminId: actingUser.userId,
      },
    })

    await Notification.create({
      userId: params.id,
      kind: "admin-adjustment",
      title: "Balance Adjustment",
      body: `Your balance was ${direction === "credit" ? "credited" : "debited"} by $${amount.toFixed(2)}. Reason: ${reason}`,
    })

    emitAuditLog({
      event: "admin.user.balance-adjusted",
      actorId: actingUser.userId,
      metadata: {
        userId: params.id,
        amount,
        direction,
        reason,
      },
    })

    const refreshedBalance = await Balance.findOne({ userId: params.id }).lean()

    return NextResponse.json({
      balance: {
        current: Number(refreshedBalance?.current ?? 0),
        totalBalance: Number(refreshedBalance?.totalBalance ?? 0),
        totalEarning: Number(refreshedBalance?.totalEarning ?? 0),
        pendingWithdraw: Number(refreshedBalance?.pendingWithdraw ?? 0),
      },
    })
  } catch (error) {
    console.error("Admin balance adjustment error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
