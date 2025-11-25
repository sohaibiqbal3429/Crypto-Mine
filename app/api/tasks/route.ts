import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { getTasksForUser } from "@/lib/services/tasks"

export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tasks = await getTasksForUser(userPayload.userId)
    return NextResponse.json({ tasks })
  } catch (error) {
    console.error("Tasks API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
