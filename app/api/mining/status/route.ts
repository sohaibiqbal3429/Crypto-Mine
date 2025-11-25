import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { getMiningStatus, MiningActionError } from "@/lib/services/mining"

export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const status = await getMiningStatus(userPayload.userId)
    const response = NextResponse.json({ success: true, ...status })
    response.headers.set(
      "Cache-Control",
      "private, max-age=0, s-maxage=60, stale-while-revalidate=30",
    )
    return response
  } catch (error: any) {
    if (error instanceof MiningActionError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Mining status error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
