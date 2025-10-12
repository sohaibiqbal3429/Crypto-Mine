import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import User from "@/models/User"
import {
  listLuckyDrawDepositsForAdmin,
  serializeLuckyDrawDeposit,
} from "@/lib/services/lucky-draw-deposits"

const DEFAULT_LIMIT = 200

export async function GET(request: NextRequest) {
  try {
    const session = getUserFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminUser = await User.findById(session.userId)
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get("status")?.toUpperCase()
    const limit = Math.min(
      DEFAULT_LIMIT,
      Math.max(1, Number.parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
    )

    let status: "PENDING" | "APPROVED" | "REJECTED" | undefined
    if (statusFilter === "PENDING" || statusFilter === "APPROVED" || statusFilter === "REJECTED") {
      status = statusFilter
    }

    const deposits = await listLuckyDrawDepositsForAdmin({
      status,
      limit,
    })

    const origin = new URL(request.url).origin
    const payload = deposits.map(({ deposit, user }) =>
      serializeLuckyDrawDeposit(deposit, { origin, user }),
    )

    return NextResponse.json({ deposits: payload })
  } catch (error) {
    console.error("Admin lucky draw deposits error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
