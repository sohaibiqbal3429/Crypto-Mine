import { NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { banUserFromBlindBox } from "@/lib/services/giftbox"

export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request as any)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload = await request.json().catch(() => null)
    if (!payload?.userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
    }

    await banUserFromBlindBox({
      adminId: user.userId,
      userId: String(payload.userId),
      address: payload.address ? String(payload.address) : undefined,
      reason: payload.reason ? String(payload.reason) : undefined,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Giftbox ban error", error)
    const message = error instanceof Error ? error.message : "Unable to ban user"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
