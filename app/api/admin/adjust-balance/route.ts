import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import Balance from "@/models/Balance"
import Transaction from "@/models/Transaction"
import Notification from "@/models/Notification"
import { getUserFromRequest } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload || userPayload.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const { userId, amount, reason, type } = await request.json()

    if (!userId || !amount || !reason || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const adjustmentAmount = Number.parseFloat(amount)
    if (Number.isNaN(adjustmentAmount)) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
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
      updateFields.$inc = {
        current: -adjustmentAmount,
        totalBalance: -adjustmentAmount,
      }
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
