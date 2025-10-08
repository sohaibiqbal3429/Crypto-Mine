import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { GiftBoxServiceError, approveGiftBoxDeposit } from "@/lib/services/giftbox"
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

    const depositId = params.id
    if (!depositId) {
      return NextResponse.json({ error: "Deposit ID is required" }, { status: 400 })
    }

    const participant = await approveGiftBoxDeposit(depositId, payload.userId)

    return NextResponse.json({
      success: true,
      participant: participant
        ? {
            id: participant._id.toString(),
            userId: participant.userId.toString(),
            depositId: participant.depositId ? participant.depositId.toString() : null,
            joinedAt: participant.createdAt
              ? new Date(participant.createdAt).toISOString()
              : new Date().toISOString(),
          }
        : null,
    })
  } catch (error: any) {
    if (error instanceof GiftBoxServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Approve gift box deposit error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
