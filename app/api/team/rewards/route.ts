import { type NextRequest, NextResponse } from "next/server"

import dbConnect from "@/lib/mongodb"
import { getUserFromRequest } from "@/lib/auth"
import { previewTeamEarnings, claimTeamEarnings } from "@/lib/services/team-earnings"

function toISO(value: unknown): string | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value as any)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0
  if (typeof value === "number") return value
  const n = Number((value as any).toString?.() ?? value)
  return Number.isFinite(n) ? n : 0
}

function serializePayer(payer: any | null | undefined) {
  if (!payer) return null
  return {
    id: payer.id ?? payer._id ?? null,
    name: payer.name ?? null,
    email: payer.email ?? null,
  }
}

function serializeClaimable(item: any) {
  return {
    id: item.id ?? item._id ?? null,
    type: item.type,
    status: item.status ?? "CLAIMABLE",
    amount: toNumber(item.amount),
    percent: toNumber(item.percent),
    baseAmount: toNumber(item.baseAmount),
    createdAt: toISO(item.createdAt),
    sourceTxId: item.sourceTxId ?? null,
    payer: serializePayer(item.payer),
  }
}

function serializeClaimed(item: any) {
  return {
    id: item.id ?? item._id ?? null,
    type: item.type,
    status: item.status ?? "CLAIMED",
    amount: toNumber(item.amount),
    percent: toNumber(item.percent),
    baseAmount: toNumber(item.baseAmount),
    createdAt: toISO(item.createdAt),
    claimedAt: toISO(item.claimedAt), // can be null if service marks later
    sourceTxId: item.sourceTxId ?? null,
    payer: serializePayer(item.payer),
  }
}

export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const preview = await previewTeamEarnings(userPayload.userId)

    return NextResponse.json({
      available: toNumber(preview.available),
      claimedTotal: toNumber(preview.claimedTotal),
      lastClaimedAt: toISO(preview.lastClaimedAt),
      pending: (preview.pending ?? []).map(serializeClaimable),
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

    // Claim any current claimables (TEAM_EARN_* only)
    const result = await claimTeamEarnings(userPayload.userId)

    if (!result || toNumber(result.claimed) <= 0) {
      return NextResponse.json({ error: "No rewards available" }, { status: 400 })
    }

    // Refresh preview after claim
    const preview = await previewTeamEarnings(userPayload.userId)

    return NextResponse.json({
      success: true,
      claimed: toNumber(result.claimed),
      creditedAmount: toNumber(result.claimed), // explicit for UI
      claimedItems: (result.items ?? []).map(serializeClaimed),
      available: toNumber(preview.available),
      claimedTotal: toNumber(preview.claimedTotal),
      lastClaimedAt: toISO(preview.lastClaimedAt),
      pending: (preview.pending ?? []).map(serializeClaimable),
    })
  } catch (error) {
    console.error("Team rewards claim error:", error)
    if (error instanceof Error && error.message === "Balance not found") {
      return NextResponse.json({ error: "Balance not found" }, { status: 404 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
