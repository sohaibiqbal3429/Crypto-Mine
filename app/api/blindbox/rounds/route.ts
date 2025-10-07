import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { BlindBoxServiceError, listBlindBoxRounds } from "@/lib/services/blindbox"

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") ?? "10")

    const rounds = await listBlindBoxRounds(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 10)

    return NextResponse.json({ rounds })
  } catch (error: any) {
    if (error instanceof BlindBoxServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Blind box rounds history error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
