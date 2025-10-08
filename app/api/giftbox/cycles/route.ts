import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { GiftBoxServiceError, listGiftBoxCycles } from "@/lib/services/giftbox"

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") ?? "10")

    const cycles = await listGiftBoxCycles(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 10)

    return NextResponse.json({ cycles })
  } catch (error: any) {
    if (error instanceof GiftBoxServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Gift box cycles history error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
