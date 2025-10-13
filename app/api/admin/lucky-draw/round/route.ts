import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import User from "@/models/User"
import {
  LuckyDrawRoundError,
  getActiveLuckyDrawRound,
  scheduleLuckyDrawWinner,
} from "@/lib/services/lucky-draw-rounds"

async function resolveAdmin(request: NextRequest) {
  const session = getUserFromRequest(request)
  if (!session) {
    return null
  }

  const adminUser = await User.findById(session.userId)
  if (!adminUser || adminUser.role !== "admin") {
    return null
  }

  return adminUser
}

export async function GET(request: NextRequest) {
  try {
    const admin = await resolveAdmin(request)
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const round = await getActiveLuckyDrawRound()
    return NextResponse.json({ round })
  } catch (error) {
    console.error("Admin lucky draw round fetch error", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await resolveAdmin(request)
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const depositId = typeof body?.depositId === "string" ? body.depositId.trim() : ""

    if (!depositId) {
      return NextResponse.json({ error: "Select an approved deposit to schedule" }, { status: 400 })
    }

    const round = await scheduleLuckyDrawWinner({ adminId: admin._id.toString(), depositId })
    return NextResponse.json({ round })
  } catch (error) {
    if (error instanceof LuckyDrawRoundError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Admin lucky draw round update error", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
