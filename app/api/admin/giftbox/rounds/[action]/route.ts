import { NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { updateRoundStatus } from "@/lib/services/giftbox"

const ACTIONS = new Set(["open", "lock", "close"])

export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  try {
    const user = getUserFromRequest(request as any)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { action } = await context.params
    if (!ACTIONS.has(action)) {
      return NextResponse.json({ error: "Unsupported action" }, { status: 404 })
    }

    const overview = await updateRoundStatus({ adminId: user.userId, action: action as any })
    return NextResponse.json({ success: true, overview })
  } catch (error) {
    console.error("Giftbox round action error", error)
    const message = error instanceof Error ? error.message : "Unable to update round"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
