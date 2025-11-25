import { type NextRequest, NextResponse } from "next/server"

import dbConnect from "@/lib/mongodb"
import { getUserFromRequest } from "@/lib/auth"
import { listTeamRewardHistory } from "@/lib/services/team-earnings"

function toISO(value: unknown): string | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value as any)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0
  if (typeof value === "number") return value
  // Handles Decimal128, BigInt as string, etc.
  const n = Number((value as any).toString?.() ?? value)
  return Number.isFinite(n) ? n : 0
}

export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    // listTeamRewardHistory should return only TEAM_EARN_* that are in history (claimed),
    // but we’ll just serialize defensively.
    const history = await listTeamRewardHistory(userPayload.userId)

    const entries = (history ?? []).map((entry: any) => ({
      id: entry.id ?? entry._id ?? null,
      type: entry.type, // expected: TEAM_EARN_L1 / TEAM_EARN_L2
      status: entry.status ?? "CLAIMED", // passthrough if available
      amount: toNumber(entry.amount),
      percent: toNumber(entry.percent),
      baseAmount: toNumber(entry.baseAmount),
      createdAt: toISO(entry.createdAt),
      claimedAt: toISO(entry.claimedAt), // null-safe
      sourceTxId: entry.sourceTxId ?? null,
      payer: entry.payer
        ? {
            id: entry.payer.id ?? entry.payer._id ?? null,
            name: entry.payer.name ?? null,
            email: entry.payer.email ?? null,
          }
        : null,
    }))

    return NextResponse.json({ entries })
  } catch (error) {
    console.error("Team rewards history error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
