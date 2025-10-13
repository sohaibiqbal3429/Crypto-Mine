import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { getActiveLuckyDrawRound } from "@/lib/services/lucky-draw-rounds"

export async function GET(request: NextRequest) {
  try {
    const session = getUserFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const round = await getActiveLuckyDrawRound()
    return NextResponse.json({ round })
  } catch (error) {
    console.error("Lucky draw round fetch error", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
