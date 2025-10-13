import { NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import dbConnect from "@/lib/mongodb"
import {
  getCurrentRoundOverview,
  getGiftBoxSettings,
  listBannedUsers,
  listRoundParticipants,
} from "@/lib/services/giftbox"
import User from "@/models/User"

export const revalidate = 0

export async function GET(request: Request) {
  try {
    const user = getUserFromRequest(request as any)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()
    const adminDoc = await User.findById(user.userId).select({ role: 1 }).lean()
    if (!adminDoc || adminDoc.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [overview, settings, bans] = await Promise.all([
      getCurrentRoundOverview(null),
      getGiftBoxSettings(),
      listBannedUsers(),
    ])

    const participants = await listRoundParticipants(overview.roundId)

    return NextResponse.json({
      overview,
      settings,
      participants,
      bans,
    })
  } catch (error) {
    console.error("Admin giftbox overview error", error)
    return NextResponse.json({ error: "Unable to load control panel" }, { status: 500 })
  }
}
