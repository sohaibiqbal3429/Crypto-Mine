import { NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { markWinnerPaid } from "@/lib/services/giftbox"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(request as any)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await context.params
    await markWinnerPaid({ adminId: user.userId, roundId: id })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Giftbox mark paid error", error)
    const message = error instanceof Error ? error.message : "Unable to mark paid"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
