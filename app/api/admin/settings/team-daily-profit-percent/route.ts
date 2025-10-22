import { revalidatePath } from "next/cache"
import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import {
  TeamDailyProfitPercentValidationError,
  getTeamDailyProfitPercent,
  getTeamDailyProfitPercentBounds,
  updateTeamDailyProfitPercent,
} from "@/lib/services/settings"

function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

async function requireAdminUser(request: NextRequest) {
  const session = getUserFromRequest(request)
  if (!session) {
    return null
  }

  await dbConnect()
  const user = await User.findById(session.userId)

  if (!user || user.role !== "admin") {
    return null
  }

  return user
}

export async function GET(request: NextRequest) {
  try {
    const adminUser = await requireAdminUser(request)
    if (!adminUser) {
      return unauthorizedResponse()
    }

    const [percent, bounds] = await Promise.all([
      getTeamDailyProfitPercent(),
      Promise.resolve(getTeamDailyProfitPercentBounds()),
    ])

    return NextResponse.json({
      teamDailyProfitPercent: percent,
      bounds,
      updatedAt: adminUser.updatedAt?.toISOString?.() ?? null,
    })
  } catch (error) {
    console.error("Failed to load team daily profit percent", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const adminUser = await requireAdminUser(request)
    if (!adminUser) {
      return unauthorizedResponse()
    }

    let payload: unknown
    try {
      payload = await request.json()
    } catch (error) {
      console.error("Invalid JSON payload for team daily profit percent", error)
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const nextValue = (payload as { percent?: unknown; value?: unknown; override?: unknown })
      ?.percent ?? (payload as any)?.value ?? (payload as any)?.override ?? null

    const nextPercent = await updateTeamDailyProfitPercent(nextValue)
    const bounds = getTeamDailyProfitPercentBounds()

    // Revalidate surfaces that display team rewards
    revalidatePath("/team")
    revalidatePath("/admin")

    return NextResponse.json({ teamDailyProfitPercent: nextPercent, bounds })
  } catch (error) {
    if (error instanceof TeamDailyProfitPercentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }

    console.error("Failed to update team daily profit percent", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

