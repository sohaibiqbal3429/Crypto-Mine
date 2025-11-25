import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import {
  LuckyDrawDepositError,
  rejectLuckyDrawDeposit,
  serializeLuckyDrawDeposit,
} from "@/lib/services/lucky-draw-deposits"
import User from "@/models/User"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = getUserFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminUser = await User.findById(session.userId).select({ role: 1 }).lean()
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const note = typeof body?.note === "string" ? body.note : undefined

    const deposit = await rejectLuckyDrawDeposit({
      adminId: session.userId,
      depositId: params.id,
      note,
    })

    if (!deposit) {
      return NextResponse.json({ error: "Deposit not found" }, { status: 404 })
    }

    const origin = new URL(request.url).origin
    const payload = serializeLuckyDrawDeposit(deposit, { origin })

    return NextResponse.json({ deposit: payload, status: payload.status })
  } catch (error: any) {
    if (error instanceof LuckyDrawDepositError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Lucky draw rejection error", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
