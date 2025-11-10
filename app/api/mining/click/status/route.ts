import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { getMiningRequestStatus } from "@/lib/services/mining-queue"

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const key = new URL(request.url).searchParams.get("key")?.trim()
  if (!key) {
    return NextResponse.json({ error: "Missing idempotency key" }, { status: 400 })
  }

  const status = await getMiningRequestStatus(key)
  if (!status || status.userId !== user.userId) {
    return NextResponse.json({ error: "Status not found" }, { status: 404 })
  }

  const headers: Record<string, string> = { "Cache-Control": "no-store" }
  let statusCode = 202

  if (status.status === "queued" || status.status === "processing") {
    if (status.queueDepth !== undefined) {
      headers["X-Queue-Depth"] = String(status.queueDepth)
    }
  }

  if (status.status === "completed") {
    statusCode = 200
  } else if (status.status === "failed") {
    statusCode = status.error?.retryable ? 429 : 409
    if (status.error?.retryAfterMs) {
      headers["Retry-After"] = Math.ceil(status.error.retryAfterMs / 1000).toString()
    }
  }

  return NextResponse.json(
    { status },
    {
      status: statusCode,
      headers,
    },
  )
}
