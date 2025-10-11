import { NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { voidEntry } from "@/lib/services/giftbox"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(request as any)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload = await request.json().catch(() => ({}))
    const { id } = await context.params

    await voidEntry({
      adminId: user.userId,
      entryId: id,
      reason: typeof payload.reason === "string" ? payload.reason : undefined,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Giftbox void entry error", error)
    const message = error instanceof Error ? error.message : "Unable to void entry"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
