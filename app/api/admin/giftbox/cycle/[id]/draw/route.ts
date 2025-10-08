import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { GiftBoxServiceError, finalizeGiftBoxCycle } from "@/lib/services/giftbox"
import User from "@/models/User"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = getUserFromRequest(request)
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminUser = await User.findById(payload.userId).select("role")
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const cycleId = params.id
    if (!cycleId) {
      return NextResponse.json({ error: "Cycle ID is required" }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const winnerId = typeof body.winnerId === "string" ? body.winnerId : undefined

    const cycle = await finalizeGiftBoxCycle(cycleId, {
      trigger: "manual",
      winnerId,
      startNextCycle: body.startNextCycle !== false,
      serverSeed: typeof body.serverSeed === "string" ? body.serverSeed : undefined,
      clientSeed: typeof body.clientSeed === "string" ? body.clientSeed : undefined,
      nonce: typeof body.nonce === "number" ? body.nonce : undefined,
    })

    return NextResponse.json({
      cycle: cycle
        ? {
            id: cycle._id.toString(),
            status: cycle.status,
            winnerUserId: cycle.winnerUserId ? cycle.winnerUserId.toString() : null,
          }
        : null,
    })
  } catch (error: any) {
    if (error instanceof GiftBoxServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Admin gift box draw error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
