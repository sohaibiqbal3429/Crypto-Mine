import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { GiftBoxServiceError, getGiftBoxAdminSummary } from "@/lib/services/giftbox"
import User from "@/models/User"

export async function GET(request: NextRequest) {
  try {
    const payload = getUserFromRequest(request)
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminUser = await User.findById(payload.userId).select("role")
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const summary = await getGiftBoxAdminSummary()

    return NextResponse.json(summary)
  } catch (error: any) {
    if (error instanceof GiftBoxServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Admin gift box overview error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
