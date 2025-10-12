import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import User from "@/models/User"
import {
  listLuckyDrawDepositsForUser,
  serializeLuckyDrawDeposit,
} from "@/lib/services/lucky-draw-deposits"

const DEFAULT_LIMIT = 50

export async function GET(request: NextRequest) {
  try {
    const session = getUserFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [deposits, user] = await Promise.all([
      listLuckyDrawDepositsForUser(session.userId, DEFAULT_LIMIT),
      User.findById(session.userId),
    ])

    const origin = new URL(request.url).origin
    const payload = deposits.map((deposit) =>
      serializeLuckyDrawDeposit(deposit, { origin, user }),
    )

    return NextResponse.json({ deposits: payload })
  } catch (error) {
    console.error("User lucky draw deposits error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
