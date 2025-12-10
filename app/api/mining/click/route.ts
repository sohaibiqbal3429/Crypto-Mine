import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { isRedisEnabled } from "@/lib/redis"
import {
  enqueueMiningRequest,
  getMiningRequestStatus,
  isMiningQueueEnabled,
  MINING_STATUS_TTL_MS,
  type MiningRequestStatus,
} from "@/lib/services/mining-queue"
import { MiningActionError, performMiningClick } from "@/lib/services/mining"
import { recordMiningMetrics } from "@/lib/services/mining-metrics"
import {
  enforceUnifiedRateLimit,
  getClientIp,
  getRateLimitContext,
} from "@/lib/rate-limit/unified"
import { recordRequestLatency, trackRequestRate } from "@/lib/observability/request-metrics"

function buildStatusResponse(
  status: MiningRequestStatus,
  request: NextRequest,
): NextResponse<{ status: MiningRequestStatus; statusUrl: string }> {
  const statusUrl = new URL("/api/mining/click/status", request.url)
  statusUrl.searchParams.set("key", status.idempotencyKey)

  let statusCode = 202
  const headers: Record<string, string> = { "Cache-Control": "no-store" }

  if (status.status === "queued" || status.status === "processing") {
    if (status.queueDepth !== undefined) {
      headers["X-Queue-Depth"] = String(status.queueDepth)
    }
  } else if (status.status === "completed") {
    statusCode = 200
    headers["Cache-Control"] = `private, max-age=0, s-maxage=${Math.floor(
      MINING_STATUS_TTL_MS / 1000,
    )}`
  } else {
    statusCode = status.error?.retryable ? 503 : 409
    if (status.error?.retryAfterMs) {
      const retrySeconds = Math.max(1, Math.ceil(status.error.retryAfterMs / 1000))
      headers["Retry-After"] = retrySeconds.toString()
      const backoffSeconds = Math.min(600, Math.pow(2, Math.ceil(Math.log2(retrySeconds))))
      headers["X-Backoff-Hint"] = backoffSeconds.toString()
    }
  }

  return NextResponse.json(
    { status, statusUrl: statusUrl.toString() },
    {
      status: statusCode,
      headers,
    },
  )
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  const path = new URL(request.url).pathname
  const rateLimitContext = getRateLimitContext(request)
  trackRequestRate("backend", { path })

  const respond = (response: NextResponse, tags: Record<string, string | number> = {}) => {
    recordRequestLatency("backend", Date.now() - startedAt, {
      path,
      status: response.status,
      ...tags,
    })
    return response
  }

  const rateDecision = await enforceUnifiedRateLimit("backend", rateLimitContext, { path })
  if (!rateDecision.allowed && rateDecision.response) {
    return respond(rateDecision.response, { outcome: "rate_limited" })
  }

  const idempotencyKey = request.headers.get("idempotency-key")?.trim()
  if (!idempotencyKey) {
    return respond(
      NextResponse.json({ error: "Idempotency-Key header is required" }, { status: 400 }),
      { outcome: "missing_idempotency" },
    )
  }

  const userPayload = getUserFromRequest(request)
  if (!userPayload) {
    return respond(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      { outcome: "unauthorized" },
    )
  }

  const ip = getClientIp(request)
  const queueAvailable = isRedisEnabled() && isMiningQueueEnabled()

  // Helper to perform mining immediately and return a completed status
  const processDirect = async (successOutcome: string) => {
    try {
      const requestedAt = new Date()
      const result = await performMiningClick(userPayload.userId, { idempotencyKey })
      const completedAt = new Date()

      await recordMiningMetrics({
        processed: 1,
        profitTotal: result.profit,
        roiCapReached: result.roiCapReached ? 1 : 0,
      })

      const status: MiningRequestStatus = {
        status: "completed",
        idempotencyKey,
        userId: userPayload.userId,
        requestedAt: requestedAt.toISOString(),
        updatedAt: completedAt.toISOString(),
        sourceIp: ip,
        userAgent: request.headers.get("user-agent"),
        queueDepth: 0,
        result: {
          ...result,
          // This is what the UI should show when the user clicks "Start Mining"
          message: "Mining rewarded",
          completedAt: completedAt.toISOString(),
        },
      }

      return respond(buildStatusResponse(status, request), { outcome: successOutcome })
    } catch (error) {
      if (error instanceof MiningActionError) {
        return respond(
          NextResponse.json({ error: error.message }, { status: error.status }),
          { outcome: "mining_error" },
        )
      }

      console.error("Mining click processing error", error)
      return respond(
        NextResponse.json(
          { error: "Unable to process mining request" },
          { status: 500 },
        ),
        { outcome: "processing_failure" },
      )
    }
  }

  // If queue is disabled/unavailable, just process immediately.
  if (!queueAvailable) {
    return processDirect("completed_no_queue")
  }

  const existingStatus = await getMiningRequestStatus(idempotencyKey)
  if (existingStatus) {
    if (existingStatus.userId !== userPayload.userId) {
      return respond(
        NextResponse.json({ error: "Idempotency key belongs to another user" }, { status: 409 }),
        { outcome: "idempotency_conflict" },
      )
    }

    return respond(buildStatusResponse(existingStatus, request), { outcome: "duplicate" })
  }

  try {
    const enqueueResult = await enqueueMiningRequest({
      userId: userPayload.userId,
      idempotencyKey,
      sourceIp: ip,
      userAgent: request.headers.get("user-agent"),
    })

    return respond(buildStatusResponse(enqueueResult.status, request), { outcome: "enqueued" })
  } catch (error) {
    // Queue failed – fall back to processing immediately so the user still gets rewarded
    console.error("Mining click enqueue error, falling back to direct processing", error)
    return processDirect("completed_after_enqueue_failure")
  }
}
