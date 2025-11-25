import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import Balance from "@/models/Balance"
import User from "@/models/User"
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

    const { userId, amount, reason, type } = await request.json()

    if (!userId || !amount || !reason || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const adjustmentAmount = Number.parseFloat(amount)
    if (Number.isNaN(adjustmentAmount) || adjustmentAmount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
    }

    const balanceDoc = await Balance.findOne({ userId })
    if (!balanceDoc) {
      return NextResponse.json({ error: "Balance not found" }, { status: 404 })
    }

    // Update balance
    const updateFields: any = {}
    if (type === "add") {
      updateFields.$inc = {
        current: adjustmentAmount,
        totalBalance: adjustmentAmount,
        totalEarning: adjustmentAmount,
      }
    } else if (type === "subtract") {
      if (adjustmentAmount > balanceDoc.current) {
        return NextResponse.json(
          {
            error: "Insufficient balance to subtract",
            currentBalance: balanceDoc.current,
            requestedAmount: adjustmentAmount,
          },
          { status: 400 },
        )
      }

      updateFields.$inc = {
        current: -adjustmentAmount,
        totalBalance: -Math.min(adjustmentAmount, balanceDoc.totalBalance ?? 0),
      }
    } else {
      return NextResponse.json({ error: "Invalid adjustment type" }, { status: 400 })
    }

    await Balance.updateOne({ userId }, updateFields)

    // Create adjustment transaction
    await Transaction.create({
      userId,
      type: "adjust",
      amount: type === "add" ? adjustmentAmount : -adjustmentAmount,
      meta: {
        reason,
        adjustmentType: type,
        adminId: userPayload.userId,
      },
    })

    // Create notification
    await Notification.create({
      userId,
      kind: "deposit-approved", // Reusing existing notification type
      title: "Balance Adjustment",
      body: `Your balance was ${type === "add" ? "increased" : "decreased"} by $${Math.abs(adjustmentAmount).toFixed(2)}. Reason: ${reason}`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Adjust balance error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
