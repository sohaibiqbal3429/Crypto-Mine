import { NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { manuallySetWinner } from "@/lib/services/giftbox"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(request as any)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload = await request.json().catch(() => null)
    if (!payload?.userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
    }

    const { id } = await context.params
    await manuallySetWinner({ adminId: user.userId, roundId: id, userId: String(payload.userId) })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Giftbox manual winner error", error)
    const message = error instanceof Error ? error.message : "Unable to set winner"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
