import { NextResponse, type NextRequest } from "next/server"

import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import { getUserFromRequest } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const session = getUserFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()
    const user = await User.findById(session.userId).select({ isBlocked: 1 }).lean()
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ blocked: Boolean(user.isBlocked) })
  } catch (error) {
    console.error("Auth status error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
