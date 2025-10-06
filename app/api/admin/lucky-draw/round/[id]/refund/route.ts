import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { LuckyDrawServiceError, refundLuckyDrawEntry } from "@/lib/services/lucky-draw"
import User from "@/models/User"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = getUserFromRequest(request)
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminUser = await User.findById(payload.userId).select("role")
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const roundId = params.id
    const body = await request.json().catch(() => ({}))
    const entryId = typeof body?.entryId === "string" ? body.entryId.trim() : ""

    if (!roundId || !entryId) {
      return NextResponse.json({ error: "roundId and entryId are required" }, { status: 400 })
    }

    await refundLuckyDrawEntry(roundId, entryId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error instanceof LuckyDrawServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Admin lucky draw refund error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
