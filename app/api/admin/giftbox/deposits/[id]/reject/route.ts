import { NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import dbConnect from "@/lib/mongodb"
import { rejectGiftBoxDeposit } from "@/lib/services/giftbox"
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
    const payload = await request.json().catch(() => ({}))

    await rejectGiftBoxDeposit({
      transactionId: id,
      adminId: user.userId,
      adminEmail: adminDoc.email ?? "",
      reason: typeof payload.reason === "string" ? payload.reason : undefined,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Reject giftbox deposit error", error)
    const message = error instanceof Error ? error.message : "Unable to reject deposit"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
