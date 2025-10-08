import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { GiftBoxServiceError, getGiftBoxSummaryForUser, joinGiftBoxCycle } from "@/lib/services/giftbox"

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const txId = typeof body?.txId === "string" ? body.txId : ""
    const network = typeof body?.network === "string" ? body.network : undefined
    const address = typeof body?.address === "string" ? body.address : undefined

    await joinGiftBoxCycle(user.userId, { txId, network, address })
    const summary = await getGiftBoxSummaryForUser(user.userId)

    return NextResponse.json({
      success: true,
      cycleId: summary.cycle?.id ?? null,
      participants: summary.participants,
      userStatus: summary.userStatus,
      nextDrawAt: summary.nextDrawAt,
    })
  } catch (error: any) {
    if (error instanceof GiftBoxServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Gift box join error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
