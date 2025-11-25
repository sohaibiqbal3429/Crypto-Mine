import { NextResponse, type NextRequest } from "next/server"

import { isRedisEnabled, getRedisClient } from "@/lib/redis"
import { consumeTokenBucket, type TokenBucketResult } from "@/lib/rate-limit/token-bucket"
import { recordThrottleHit } from "@/lib/observability/request-metrics"

const RATE_LIMIT_INTERVAL_MS = 1000
const RATE_LIMIT_BURST = Number(process.env.RATE_LIMIT_BURST ?? 2000)
const RATE_LIMIT_IP_RPS = Number(process.env.RATE_LIMIT_IP_RPS ?? 50)
const RATE_LIMIT_API_KEY_RPS = Number(process.env.RATE_LIMIT_API_KEY_RPS ?? 200)

const STATIC_ROUTE_PREFIXES = ["/static", "/assets", "/images", "/cdn", "/cdn/"]
const STATIC_ROUTE_EXACT = new Set(["/status"])

const DEFAULT_WHITELIST = [
  "127.0.0.1",
  "::1",
  "::ffff:127.0.0.1",
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
]

const WHITELIST: string[] = (() => {
  const fromEnv = process.env.RATE_LIMIT_IP_WHITELIST
  if (!fromEnv) {
    return DEFAULT_WHITELIST
  }

  const items = fromEnv
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
  return [...new Set([...DEFAULT_WHITELIST, ...items])]
})()

function isValidIPv4(ip: string): boolean {
  if (!ip) {
    return false
  }

  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    return false
  }

  return ip.split(".").every((segment) => {
    if (segment.length === 0) {
      return false
    }

    const value = Number(segment)
    return Number.isInteger(value) && value >= 0 && value <= 255
  })
}

function isValidHextet(segment: string): boolean {
  return /^[0-9a-f]{1,4}$/i.test(segment)
}

function isValidIPv6(ip: string): boolean {
  if (!ip) {
    return false
  }

  const value = ip.toLowerCase()
  if (value === "::") {
    return true
  }

  const doubleColonIndex = value.indexOf("::")
  if (doubleColonIndex !== -1 && value.indexOf("::", doubleColonIndex + 1) !== -1) {
    return false
  }

  const [headRaw, tailRaw] = value.split("::") as [string, string | undefined]
  const headParts = headRaw ? headRaw.split(":") : []
  const tailParts = tailRaw ? tailRaw.split(":") : []

  const cleanHead = headParts.filter((part) => part.length > 0)
  const cleanTail = tailParts.filter((part) => part.length > 0)

  let ipv4Segments = 0

  const validateSegment = (segment: string, isLast: boolean): boolean => {
    if (segment.length === 0) {
      return false
    }

    if (segment.includes(".")) {
      if (!isLast || !isValidIPv4(segment)) {
        return false
      }

      ipv4Segments = 2
      return true
    }

    return isValidHextet(segment)
  }

  if (!cleanHead.every((segment) => validateSegment(segment, false))) {
    return false
  }

  if (
    !cleanTail.every((segment, index) => validateSegment(segment, index === cleanTail.length - 1))
  ) {
    return false
  }

  const segmentsCount = cleanHead.length + cleanTail.length + ipv4Segments
  if (doubleColonIndex === -1) {
    return segmentsCount === 8
  }

  return segmentsCount < 8
}

function detectIpVersion(ip: string): 0 | 4 | 6 {
  if (!ip) {
    return 0
  }

  const trimmed = ip.trim()
  if (trimmed.length === 0) {
    return 0
  }

  if (isValidIPv4(trimmed)) {
    return 4
  }

  if (isValidIPv6(trimmed)) {
    return 6
  }

  return 0
}

interface LocalBucketState {
  tokens: number
  lastRefill: number
}

type LocalBucketStore = Map<string, LocalBucketState>

type GlobalWithBuckets = typeof globalThis & {
  __LOCAL_TOKEN_BUCKETS__?: LocalBucketStore
}

export interface RateLimitContext {
  ip: string
  apiKey: string | null
}

export type RateLimitLayer = "cdn" | "reverse-proxy" | "backend"

export interface RateLimitDecision {
  allowed: boolean
  response?: NextResponse
}

function getLocalBucketStore(): LocalBucketStore {
  const globalScope = globalThis as GlobalWithBuckets
  if (!globalScope.__LOCAL_TOKEN_BUCKETS__) {
    globalScope.__LOCAL_TOKEN_BUCKETS__ = new Map<string, LocalBucketState>()
  }

  return globalScope.__LOCAL_TOKEN_BUCKETS__
}

function normalisePathname(pathname: string): string {
  if (!pathname) {
    return "/"
  }

  return pathname.startsWith("/") ? pathname.toLowerCase() : `/${pathname.toLowerCase()}`
}

interface NormalisedIp {
  value: string
  version: 4 | 6
}

function normaliseIp(ip: string): NormalisedIp | null {
  if (!ip) {
    return null
  }

  const maybeIPv4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip
  const version = detectIpVersion(maybeIPv4)
  if (version === 4) {
    return { value: maybeIPv4, version }
  }

  const v6Version = detectIpVersion(ip)
  if (v6Version === 6) {
    return { value: ip, version: v6Version }
  }

  return null
}

function ipv4ToBigInt(ip: string): bigint {
  return ip.split(".").reduce<bigint>((acc, segment) => {
    const value = BigInt(Number.parseInt(segment, 10) & 0xff)
    return (acc << 8n) + value
  }, 0n)
}

function expandIpv6(ip: string): number[] {
  const [head = "", tail = ""] = ip.split("::")
  const parseSegment = (segment: string) => Number.parseInt(segment || "0", 16) || 0

  const headParts = head
    .split(":")
    .filter((part) => part.length > 0)
    .map(parseSegment)
  const tailParts = tail
    .split(":")
    .filter((part) => part.length > 0)
    .map(parseSegment)

  const missing = Math.max(0, 8 - (headParts.length + tailParts.length))
  return [...headParts, ...new Array(missing).fill(0), ...tailParts]
}

function ipv6ToBigInt(ip: string): bigint {
  return expandIpv6(ip).reduce<bigint>((acc, segment) => {
    const value = BigInt(segment & 0xffff)
    return (acc << 16n) + value
  }, 0n)
}

function maskBits(version: 4 | 6, prefix: number): bigint {
  if (prefix <= 0) {
    return 0n
  }

  const width = version === 4 ? 32 : 128
  const shift = BigInt(width - Math.min(prefix, width))
  const full = (1n << BigInt(width)) - 1n
  return full ^ ((1n << shift) - 1n)
}

function isIpInCidr(ip: NormalisedIp, cidr: string): boolean {
  const [rawBase, rawPrefix] = cidr.split("/")
  if (!rawBase || !rawPrefix) {
    return false
  }

  const base = normaliseIp(rawBase)
  if (!base || base.version !== ip.version) {
    return false
  }

  const prefix = Number.parseInt(rawPrefix, 10)
  if (!Number.isFinite(prefix) || prefix < 0) {
    return false
  }

  if (ip.version === 4) {
    const mask = maskBits(4, prefix)
    const ipValue = ipv4ToBigInt(ip.value)
    const baseValue = ipv4ToBigInt(base.value)
    return (ipValue & mask) === (baseValue & mask)
  }

  const mask = maskBits(6, prefix)
  const ipValue = ipv6ToBigInt(ip.value)
  const baseValue = ipv6ToBigInt(base.value)
  return (ipValue & mask) === (baseValue & mask)
}

function ipMatchesWhitelist(ip: string, rule: string): boolean {
  if (!rule) {
    return false
  }

  const normalised = normaliseIp(ip)
  if (!normalised) {
    return false
  }

  if (rule.includes("/")) {
    return isIpInCidr(normalised, rule)
  }

  if (rule.endsWith("*")) {
    const comparisonValue = normalised.value
    return comparisonValue.startsWith(rule.slice(0, -1))
  }

  const ruleNormalised = normaliseIp(rule)
  if (ruleNormalised) {
    return ruleNormalised.version === normalised.version && ruleNormalised.value === normalised.value
  }

  return normalised.value === rule
}

export function isWhitelistedIp(ip: string | null | undefined): boolean {
  if (!ip) {
    return false
  }

  return WHITELIST.some((rule) => ipMatchesWhitelist(ip, rule))
}

export function shouldBypassRateLimit(pathname: string, context: RateLimitContext): boolean {
  const normalised = normalisePathname(pathname)
  if (STATIC_ROUTE_EXACT.has(normalised)) {
    return true
  }

  if (STATIC_ROUTE_PREFIXES.some((prefix) => normalised.startsWith(prefix))) {
    return true
  }

  if (isWhitelistedIp(context.ip)) {
    return true
  }

  return false
}

function buildThrottleResponse(
  layer: RateLimitLayer,
  scopes: string[],
  retryAfterSeconds: number,
  metadata: { ip?: string | null; apiKey?: string | null; path?: string },
): NextResponse {
  const safeRetry = Math.max(1, Math.ceil(retryAfterSeconds))
  const backoffSeconds = Math.min(600, Math.pow(2, Math.ceil(Math.log2(Math.max(1, safeRetry)))))
  const maskedApiKey = metadata.apiKey ? `${metadata.apiKey.slice(0, 4)}…${metadata.apiKey.slice(-4)}` : undefined

  console.warn(
    `[rate-limit] ${layer} throttle`,
    {
      layer,
      scopes,
      retryAfterSeconds: safeRetry,
      path: metadata.path,
      ip: metadata.ip,
      apiKey: maskedApiKey,
    },
  )

  recordThrottleHit(layer, scopes.join(","), {
    path: metadata.path,
  })

  const response = NextResponse.json(
    {
      error: "Too many requests",
      layer,
      scope: scopes,
      retryAfterSeconds: safeRetry,
      backoffSeconds,
      message: `Rate limit exceeded at ${layer} layer. Retry after ${safeRetry}s using exponential backoff (next attempt in ~${backoffSeconds}s).`,
    },
    { status: 429 },
  )

  response.headers.set("Retry-After", safeRetry.toString())
  response.headers.set("X-Backoff-Hint", backoffSeconds.toString())
  response.headers.set("X-RateLimit-Layer", layer)
  response.headers.set("X-RateLimit-Scope", scopes.join(","))

  return response
}

function toLocalBucketKey(key: string): string {
  return `local:${key}`
}

function consumeLocalTokenBucket(
  key: string,
  tokensPerInterval: number,
  intervalMs: number,
  maxTokens: number,
): TokenBucketResult {
  const store = getLocalBucketStore()
  const bucketKey = toLocalBucketKey(key)
  const now = Date.now()
  const bucket = store.get(bucketKey) ?? { tokens: maxTokens, lastRefill: now }

  const elapsed = now - bucket.lastRefill
  if (elapsed > 0) {
    const refillTokens = (elapsed / intervalMs) * tokensPerInterval
    bucket.tokens = Math.min(maxTokens, bucket.tokens + refillTokens)
    bucket.lastRefill = now
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1
    store.set(bucketKey, bucket)
    return { allowed: true, remaining: Math.floor(bucket.tokens), retryAfterMs: 0 }
  }

  const deficit = 1 - bucket.tokens
  const retryAfterMs = Math.max(intervalMs, Math.ceil((deficit / tokensPerInterval) * intervalMs))
  bucket.tokens = Math.max(0, bucket.tokens)
  store.set(bucketKey, bucket)

  return { allowed: false, remaining: Math.floor(bucket.tokens), retryAfterMs }
}

async function consumeUnifiedBucket(
  key: string,
  tokensPerInterval: number,
  intervalMs: number,
  maxTokens: number,
): Promise<TokenBucketResult> {
  if (isRedisEnabled()) {
    const client = getRedisClient()
    return consumeTokenBucket({
      key,
      tokensPerInterval,
      intervalMs,
      maxTokens,
      client,
    })
  }

  return consumeLocalTokenBucket(key, tokensPerInterval, intervalMs, maxTokens)
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) {
      return first
    }
  }

  if (request.ip) {
    return request.ip
  }

  return "unknown"
}

export function getApiKey(request: NextRequest): string | null {
  const apiKeyHeader = request.headers.get("x-api-key") || request.headers.get("api-key")
  if (apiKeyHeader) {
    return apiKeyHeader.trim()
  }

  const authorization = request.headers.get("authorization")
  if (authorization) {
    const parts = authorization.split(" ")
    if (parts.length === 2 && /^api-key$/i.test(parts[0])) {
      return parts[1]?.trim() || null
    }
  }

  return null
}

export function getRateLimitContext(request: NextRequest): RateLimitContext {
  return {
    ip: getClientIp(request),
    apiKey: getApiKey(request),
  }
}

export async function enforceUnifiedRateLimit(
  layer: RateLimitLayer,
  context: RateLimitContext,
  metadata: { path?: string } = {},
): Promise<RateLimitDecision> {
  if (isWhitelistedIp(context.ip)) {
    return { allowed: true }
  }

  const scopes: Array<{ label: string; result: TokenBucketResult }> = []

  if (context.ip && context.ip !== "unknown") {
    const ipKey = `rate:ip:${context.ip}`
    const ipResult = await consumeUnifiedBucket(ipKey, RATE_LIMIT_IP_RPS, RATE_LIMIT_INTERVAL_MS, RATE_LIMIT_BURST)
    if (!ipResult.allowed) {
      scopes.push({ label: "ip", result: ipResult })
    }
  }

  if (context.apiKey) {
    const apiKey = context.apiKey
    const apiKeyResult = await consumeUnifiedBucket(
      `rate:api:${apiKey}`,
      RATE_LIMIT_API_KEY_RPS,
      RATE_LIMIT_INTERVAL_MS,
      RATE_LIMIT_BURST,
    )
    if (!apiKeyResult.allowed) {
      scopes.push({ label: "api-key", result: apiKeyResult })
    }
  }

  if (scopes.length === 0) {
    return { allowed: true }
  }

  const retryAfterMs = Math.max(...scopes.map((scope) => scope.result.retryAfterMs))
  const retryAfterSeconds = retryAfterMs / 1000
  const response = buildThrottleResponse(layer, scopes.map((scope) => scope.label), retryAfterSeconds, {
    ip: context.ip,
    apiKey: context.apiKey,
    path: metadata.path,
  })

  return { allowed: false, response }
}

export const RATE_LIMIT_EXPORT = {
  ip: {
    tokensPerInterval: RATE_LIMIT_IP_RPS,
    intervalMs: RATE_LIMIT_INTERVAL_MS,
    maxTokens: RATE_LIMIT_BURST,
  },
  apiKey: {
    tokensPerInterval: RATE_LIMIT_API_KEY_RPS,
    intervalMs: RATE_LIMIT_INTERVAL_MS,
    maxTokens: RATE_LIMIT_BURST,
  },
  whitelist: WHITELIST,
  staticRoutes: {
    prefixes: STATIC_ROUTE_PREFIXES,
    exact: Array.from(STATIC_ROUTE_EXACT),
  },
}
