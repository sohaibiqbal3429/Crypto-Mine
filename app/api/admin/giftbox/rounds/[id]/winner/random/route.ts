import { NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { randomizeWinner } from "@/lib/services/giftbox"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(request as any)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await context.params
    await randomizeWinner({ adminId: user.userId, roundId: id })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Giftbox random winner error", error)
    const message = error instanceof Error ? error.message : "Unable to pick winner"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
