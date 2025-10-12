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
      level: preview.level,
      rate: preview.rate,
      coverage: preview.coverage,
      windowStart: preview.windowStart ? preview.windowStart.toISOString() : null,
      windowEnd: preview.windowEnd ? preview.windowEnd.toISOString() : null,
      dgpCount: preview.dgpCount,
      totalDgp: preview.totalDgp,
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
      return NextResponse.json(
        {
          error: result.message ?? "No rewards available",
          level: result.level,
          rate: result.rate,
          coverage: result.coverage,
          windowStart: result.windowStart ? result.windowStart.toISOString() : null,
          windowEnd: result.windowEnd ? result.windowEnd.toISOString() : null,
          dgpCount: result.dgpCount,
          totalDgp: result.totalDgp,
          claimedTotal: result.claimedTotal,
          lastClaimedAt: result.lastClaimedAt ? result.lastClaimedAt.toISOString() : null,
        },
        { status: 400 },
      )
    }

    return NextResponse.json({
      success: true,
      amount: result.claimed,
      level: result.level,
      rate: result.rate,
      coverage: result.coverage,
      windowStart: result.windowStart ? result.windowStart.toISOString() : null,
      windowEnd: result.windowEnd ? result.windowEnd.toISOString() : null,
      dgpCount: result.dgpCount,
      totalDgp: result.totalDgp,
      claimedTotal: result.claimedTotal,
      lastClaimedAt: result.lastClaimedAt ? result.lastClaimedAt.toISOString() : null,
    })
  } catch (error) {
    console.error("Team rewards claim error:", error)
    if (error instanceof Error && error.message === "Balance not found") {
      return NextResponse.json({ error: "Balance not found" }, { status: 404 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
