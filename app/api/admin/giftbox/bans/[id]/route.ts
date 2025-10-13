import { NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { unbanUserFromBlindBox } from "@/lib/services/giftbox"

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(request as any)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await context.params
    await unbanUserFromBlindBox({ adminId: user.userId, userId: id })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Giftbox unban error", error)
    const message = error instanceof Error ? error.message : "Unable to unban user"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
