import { NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import dbConnect from "@/lib/mongodb"
import { approveGiftBoxDeposit } from "@/lib/services/giftbox"
import User from "@/models/User"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(request as any)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()
    const adminDoc = await User.findById(user.userId).select({ role: 1, email: 1 }).lean()
    if (!adminDoc || adminDoc.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await context.params

    const result = await approveGiftBoxDeposit({
      transactionId: id,
      adminId: user.userId,
      adminEmail: adminDoc.email ?? "",
    })

    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error("Approve giftbox deposit error", error)
    const message = error instanceof Error ? error.message : "Unable to approve deposit"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
