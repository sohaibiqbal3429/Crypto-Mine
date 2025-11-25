import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { getMiningRequestStatus } from "@/lib/services/mining-queue"
import { enforceUnifiedRateLimit, getRateLimitContext } from "@/lib/rate-limit/unified"
import { recordRequestLatency, trackRequestRate } from "@/lib/observability/request-metrics"

export async function GET(request: NextRequest) {
  const startedAt = Date.now()
  const path = new URL(request.url).pathname
  const rateContext = getRateLimitContext(request)
  trackRequestRate("backend", { path })

  const respond = (response: NextResponse, tags: Record<string, string | number> = {}) => {
    recordRequestLatency("backend", Date.now() - startedAt, { path, status: response.status, ...tags })
    return response
  }

  const rateDecision = await enforceUnifiedRateLimit("backend", rateContext, { path })
  if (!rateDecision.allowed && rateDecision.response) {
    return respond(rateDecision.response, { outcome: "rate_limited" })
  }

  const user = getUserFromRequest(request)
  if (!user) {
    return respond(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), { outcome: "unauthorized" })
  }

  const key = new URL(request.url).searchParams.get("key")?.trim()
  if (!key) {
    return respond(NextResponse.json({ error: "Missing idempotency key" }, { status: 400 }), {
      outcome: "missing_idempotency",
    })
  }

  const status = await getMiningRequestStatus(key)
  if (!status || status.userId !== user.userId) {
    return respond(NextResponse.json({ error: "Status not found" }, { status: 404 }), {
      outcome: "not_found",
    })
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
    statusCode = status.error?.retryable ? 503 : 409
    if (status.error?.retryAfterMs) {
      const retrySeconds = Math.max(1, Math.ceil(status.error.retryAfterMs / 1000))
      headers["Retry-After"] = retrySeconds.toString()
      const backoffSeconds = Math.min(600, Math.pow(2, Math.ceil(Math.log2(retrySeconds))))
      headers["X-Backoff-Hint"] = backoffSeconds.toString()
    }
  }

  return respond(
    NextResponse.json(
      { status },
      {
        status: statusCode,
        headers,
      },
    ),
    { outcome: status.status },
  )
}
