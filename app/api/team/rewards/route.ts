import { type NextRequest, NextResponse } from "next/server"

import dbConnect from "@/lib/mongodb"
import { getUserFromRequest } from "@/lib/auth"
import { previewTeamEarnings, claimTeamEarnings } from "@/lib/services/team-earnings"

export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const preview = await previewTeamEarnings(userPayload.userId)

    return NextResponse.json({
      available: preview.available,
      claimedTotal: preview.claimedTotal,
      lastClaimedAt: preview.lastClaimedAt ? preview.lastClaimedAt.toISOString() : null,
      pending: preview.pending.map((item) => ({
        id: item.id,
        type: item.type,
        amount: item.amount,
        percent: item.percent,
        baseAmount: item.baseAmount,
        createdAt: item.createdAt.toISOString(),
        sourceTxId: item.sourceTxId,
        payer: item.payer
          ? {
              id: item.payer.id,
              name: item.payer.name,
              email: item.payer.email,
            }
          : null,
      })),
    })
  } catch (error) {
    console.error("Team rewards fetch error:", error)
    if (error instanceof Error && error.message === "Balance not found") {
      return NextResponse.json({ error: "Balance not found" }, { status: 404 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const result = await claimTeamEarnings(userPayload.userId)

    if (result.claimed <= 0) {
      return NextResponse.json({ error: "No rewards available" }, { status: 400 })
    }

    const preview = await previewTeamEarnings(userPayload.userId)

    return NextResponse.json({
      success: true,
      claimed: result.claimed,
      creditedAmount: result.claimed,
      claimedItems: result.items.map((item) => ({
        id: item.id,
        type: item.type,
        amount: item.amount,
        percent: item.percent,
        baseAmount: item.baseAmount,
        createdAt: item.createdAt.toISOString(),
        claimedAt: item.claimedAt.toISOString(),
        sourceTxId: item.sourceTxId,
        payer: item.payer
          ? {
              id: item.payer.id,
              name: item.payer.name,
              email: item.payer.email,
            }
          : null,
      })),
      available: preview.available,
      claimedTotal: preview.claimedTotal,
      lastClaimedAt: preview.lastClaimedAt ? preview.lastClaimedAt.toISOString() : null,
      pending: preview.pending.map((item) => ({
        id: item.id,
        type: item.type,
        amount: item.amount,
        percent: item.percent,
        baseAmount: item.baseAmount,
        createdAt: item.createdAt.toISOString(),
        sourceTxId: item.sourceTxId,
        payer: item.payer
          ? {
              id: item.payer.id,
              name: item.payer.name,
              email: item.payer.email,
            }
          : null,
      })),
    })
  } catch (error) {
    console.error("Team rewards claim error:", error)
    if (error instanceof Error && error.message === "Balance not found") {
      return NextResponse.json({ error: "Balance not found" }, { status: 404 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
