import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { getRedisClient, isRedisEnabled } from "@/lib/redis"
import { consumeTokenBucket } from "@/lib/rate-limit/token-bucket"
import {
  enqueueMiningRequest,
  getMiningRequestStatus,
  isMiningQueueEnabled,
  MINING_STATUS_TTL_MS,
  type MiningRequestStatus,
} from "@/lib/services/mining-queue"

const GLOBAL_BUCKET_KEY = "rate:mining:global"
const USER_BUCKET_PREFIX = "rate:mining:user:"
const IP_BUCKET_PREFIX = "rate:mining:ip:"

const USER_RATE_LIMIT = {
  tokensPerInterval: Number(process.env.MINING_RATE_LIMIT_PER_USER ?? 5),
  intervalMs: 1000,
  maxTokens: Number(process.env.MINING_RATE_LIMIT_USER_BURST ?? 10),
}

const GLOBAL_RATE_LIMIT = {
  tokensPerInterval: Number(process.env.MINING_RATE_LIMIT_GLOBAL ?? 12000),
  intervalMs: 1000,
  maxTokens: Number(process.env.MINING_RATE_LIMIT_GLOBAL_BURST ?? 24000),
}

const IP_RATE_LIMIT = {
  tokensPerInterval: Number(process.env.MINING_RATE_LIMIT_PER_IP ?? 20),
  intervalMs: 1000,
  maxTokens: Number(process.env.MINING_RATE_LIMIT_IP_BURST ?? 40),
}

function parseClientIp(request: NextRequest): string {
  const directIp = request.ip
  if (directIp) {
    return directIp
  }

  const forwardedFor = request.headers.get("x-forwarded-for")
  if (!forwardedFor) {
    return "unknown"
  }

  return forwardedFor.split(",")[0]?.trim() || "unknown"
}

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
    headers["Cache-Control"] = `private, max-age=0, s-maxage=${Math.floor(MINING_STATUS_TTL_MS / 1000)}`
  } else {
    statusCode = status.error?.retryable ? 429 : 409
    if (status.error?.retryAfterMs) {
      headers["Retry-After"] = Math.ceil(status.error.retryAfterMs / 1000).toString()
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
  if (!isRedisEnabled() || !isMiningQueueEnabled()) {
    return NextResponse.json(
      {
        error: "Mining queue is not available. Configure REDIS_URL and queue workers.",
      },
      { status: 503 },
    )
  }

  const idempotencyKey = request.headers.get("idempotency-key")?.trim()
  if (!idempotencyKey) {
    return NextResponse.json({ error: "Idempotency-Key header is required" }, { status: 400 })
  }

  const userPayload = getUserFromRequest(request)
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const existingStatus = await getMiningRequestStatus(idempotencyKey)
  if (existingStatus) {
    if (existingStatus.userId !== userPayload.userId) {
      return NextResponse.json({ error: "Idempotency key belongs to another user" }, { status: 409 })
    }

    return buildStatusResponse(existingStatus, request)
  }

  const redis = getRedisClient()
  const ip = parseClientIp(request)

  const [globalLimit, userLimit, ipLimit] = await Promise.all([
    consumeTokenBucket({
      key: GLOBAL_BUCKET_KEY,
      ...GLOBAL_RATE_LIMIT,
      client: redis,
    }),
    consumeTokenBucket({
      key: `${USER_BUCKET_PREFIX}${userPayload.userId}`,
      ...USER_RATE_LIMIT,
      client: redis,
    }),
    consumeTokenBucket({
      key: `${IP_BUCKET_PREFIX}${ip}`,
      ...IP_RATE_LIMIT,
      client: redis,
    }),
  ])

  const limitBreaches = [
    { label: "global", result: globalLimit },
    { label: "user", result: userLimit },
    { label: "ip", result: ipLimit },
  ].filter((entry) => !entry.result.allowed)

  if (limitBreaches.length > 0) {
    const retryAfter = Math.max(...limitBreaches.map((entry) => entry.result.retryAfterMs || 0))
    const response = NextResponse.json(
      {
        error: "Too many requests",
        scope: limitBreaches.map((entry) => entry.label),
      },
      { status: 429 },
    )
    if (retryAfter > 0) {
      response.headers.set("Retry-After", Math.max(1, Math.ceil(retryAfter / 1000)).toString())
    }
    return response
  }

  try {
    const enqueueResult = await enqueueMiningRequest({
      userId: userPayload.userId,
      idempotencyKey,
      sourceIp: ip,
      userAgent: request.headers.get("user-agent"),
    })

    return buildStatusResponse(enqueueResult.status, request)
  } catch (error) {
    console.error("Mining click enqueue error", error)
    return NextResponse.json(
      {
        error: "Unable to queue mining request",
      },
      { status: 500 },
    )
  }
}
