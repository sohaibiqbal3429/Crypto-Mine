import { NextResponse, type NextRequest } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import dbConnect from "@/lib/mongodb"
import { reportQueue } from "@/lib/queue"
import User from "@/models/User"

export async function POST(request: NextRequest) {
  try {
    const session = getUserFromRequest(request as any)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const adminUser = await User.findById(session.userId).select({ email: 1, role: 1 }).lean()
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))

    await reportQueue.add("tx-export", {
      ...body,
      adminId: session.userId,
      requestedAt: new Date().toISOString(),
    })

    return NextResponse.json({ queued: true })
  } catch (error) {
    console.error("Queue export error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
