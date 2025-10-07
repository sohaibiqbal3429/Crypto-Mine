import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { BlindBoxServiceError, approveBlindBoxDeposit } from "@/lib/services/blindbox"
import User from "@/models/User"

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = getUserFromRequest(_request)
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminUser = await User.findById(payload.userId).select("role")
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const depositId = params.id
    if (!depositId) {
      return NextResponse.json({ error: "Deposit ID is required" }, { status: 400 })
    }

    await approveBlindBoxDeposit({ depositId, adminId: payload.userId })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error instanceof BlindBoxServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Admin approve blind box deposit error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
