import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import dbConnect from "@/lib/mongodb"
import { getKpis } from "@/lib/services/kpis"
import User from "@/models/User"

export async function GET(request: NextRequest) {
  try {
    const session = getUserFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const adminUser = await User.findById(session.userId).lean()
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const kpis = await getKpis()
    return NextResponse.json({ kpis })
  } catch (error) {
    console.error("Admin KPIs error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
