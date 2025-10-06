import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { claimTaskReward, TaskRewardError } from "@/lib/services/tasks"

export async function POST(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const taskId = typeof body?.taskId === "string" ? body.taskId.trim() : ""

    if (!taskId) {
      return NextResponse.json({ error: "A valid taskId is required" }, { status: 400 })
    }

    const result = await claimTaskReward(userPayload.userId, taskId)

    return NextResponse.json({
      success: true,
      reward: result.reward,
      claimedAt: result.claimedAt,
      balance: result.balance,
    })
  } catch (error) {
    if (error instanceof TaskRewardError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }

    console.error("Task reward claim error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
