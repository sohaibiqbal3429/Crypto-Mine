import { revalidatePath } from "next/cache"
import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import {
  DailyProfitPercentValidationError,
  getDailyProfitPercent,
  getDailyProfitPercentBounds,
  updateDailyProfitPercent,
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

    const [dailyProfitPercent, bounds] = await Promise.all([
      getDailyProfitPercent(),
      Promise.resolve(getDailyProfitPercentBounds()),
    ])

    return NextResponse.json({
      dailyProfitPercent,
      bounds,
      updatedAt: adminUser.updatedAt?.toISOString?.() ?? null,
    })
  } catch (error) {
    console.error("Failed to load daily profit percent", error)
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
      console.error("Invalid JSON payload for daily profit percent", error)
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const percentValue = (payload as { percent?: unknown })?.percent
    if (percentValue === undefined) {
      return NextResponse.json({ error: "percent is required" }, { status: 400 })
    }

    const nextPercent = await updateDailyProfitPercent(percentValue)
    const bounds = getDailyProfitPercentBounds()

    revalidatePath("/mining")
    revalidatePath("/dashboard")

    return NextResponse.json({ dailyProfitPercent: nextPercent, bounds })
  } catch (error) {
    if (error instanceof DailyProfitPercentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }

    console.error("Failed to update daily profit percent", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
