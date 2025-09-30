import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { performMiningClick, MiningActionError } from "@/lib/services/mining"

export async function POST(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await performMiningClick(userPayload.userId)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error: any) {
    if (error instanceof MiningActionError) {
      const response: Record<string, any> = { error: error.message }
      if ((error as any).details) {
        Object.assign(response, (error as any).details)
      }
      return NextResponse.json(response, { status: error.status })
    }

    console.error("Mining click error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
