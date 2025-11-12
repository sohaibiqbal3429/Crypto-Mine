import { NextResponse, type NextRequest } from "next/server"

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

type LocalBucketKey = string

interface LocalBucketState {
  tokens: number
  lastRefill: number
}

type LocalBucketStore = Map<LocalBucketKey, LocalBucketState>

type GlobalWithBuckets = typeof globalThis & {
  __EDGE_RATE_LIMIT_BUCKETS__?: LocalBucketStore
}

function getStore(): LocalBucketStore {
  const globalScope = globalThis as GlobalWithBuckets
  if (!globalScope.__EDGE_RATE_LIMIT_BUCKETS__) {
    globalScope.__EDGE_RATE_LIMIT_BUCKETS__ = new Map()
  }
  return globalScope.__EDGE_RATE_LIMIT_BUCKETS__
}

function normalisePathname(pathname: string): string {
  if (!pathname) {
    return "/"
  }
  return pathname.startsWith("/") ? pathname.toLowerCase() : `/${pathname.toLowerCase()}`
}

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

  const cleanHead = headParts.filter((segment) => segment.length > 0)
  const cleanTail = tailParts.filter((segment) => segment.length > 0)

  const validateSegment = (segment: string, isLast: boolean): boolean => {
    if (segment.length === 0) {
      return false
    }
    if (segment.includes(".")) {
      if (!isLast || !isValidIPv4(segment)) {
        return false
      }
      return true
    }
    return isValidHextet(segment)
  }

  if (!cleanHead.every((segment) => validateSegment(segment, false))) {
    return false
  }
  if (!cleanTail.every((segment, index) => validateSegment(segment, index === cleanTail.length - 1))) {
    return false
  }

  const segmentsCount = cleanHead.length + cleanTail.length
  return doubleColonIndex === -1 ? segmentsCount === 8 : segmentsCount < 8
}

type NormalisedIp = {
  value: string
  version: 4 | 6
}

function normaliseIp(ip: string): NormalisedIp | null {
  if (!ip) {
    return null
  }
  const maybeIPv4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip
  if (isValidIPv4(maybeIPv4)) {
    return { value: maybeIPv4, version: 4 }
  }
  if (isValidIPv6(ip)) {
    return { value: ip, version: 6 }
  }
  return null
}

function isIpInCidr(ip: NormalisedIp, rule: string): boolean {
  const [rawBase, rawPrefix] = rule.split("/")
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
    const mask = (0xffffffff << (32 - Math.min(prefix, 32))) >>> 0
    const ipValue = ip.value.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0
    const baseValue = base.value.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0
    return (ipValue & mask) === (baseValue & mask)
  }

  const segments = (value: string) =>
    value
      .split(":")
      .filter((segment) => segment.length > 0)
      .map((segment) => Number.parseInt(segment, 16) || 0)

  const expand = (value: string): number[] => {
    const [head = "", tail = ""] = value.split("::")
    const headParts = segments(head)
    const tailParts = segments(tail)
    const missing = Math.max(0, 8 - (headParts.length + tailParts.length))
    return [...headParts, ...new Array(missing).fill(0), ...tailParts]
  }

  const maskBits = (prefixLength: number): bigint => {
    if (prefixLength <= 0) {
      return 0n
    }
    const shift = BigInt(128 - Math.min(prefixLength, 128))
    const full = (1n << 128n) - 1n
    return full ^ ((1n << shift) - 1n)
  }

  const ipValue = expand(ip.value).reduce<bigint>((acc, segment) => (acc << 16n) + BigInt(segment & 0xffff), 0n)
  const baseValue = expand(base.value).reduce<bigint>((acc, segment) => (acc << 16n) + BigInt(segment & 0xffff), 0n)
  const mask = maskBits(prefix)
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
    return normalised.value.startsWith(rule.slice(0, -1))
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

function getLocalBucket(key: LocalBucketKey): LocalBucketState {
  const store = getStore()
  const existing = store.get(key)
  if (existing) {
    return existing
  }
  const initial: LocalBucketState = { tokens: RATE_LIMIT_BURST, lastRefill: Date.now() }
  store.set(key, initial)
  return initial
}

function consumeLocalBucket(key: LocalBucketKey, tokensPerInterval: number, intervalMs: number, maxTokens: number) {
  const bucket = getLocalBucket(key)
  const now = Date.now()
  const elapsed = now - bucket.lastRefill
  if (elapsed > 0) {
    const refillTokens = (elapsed / intervalMs) * tokensPerInterval
    bucket.tokens = Math.min(maxTokens, bucket.tokens + refillTokens)
    bucket.lastRefill = now
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1
    return { allowed: true as const, remaining: Math.floor(bucket.tokens), retryAfterMs: 0 }
  }

  const deficit = 1 - bucket.tokens
  const retryAfterMs = Math.max(intervalMs, Math.ceil((deficit / tokensPerInterval) * intervalMs))
  bucket.tokens = Math.max(0, bucket.tokens)
  return { allowed: false as const, remaining: Math.floor(bucket.tokens), retryAfterMs }
}

export type RateLimitLayer = "cdn" | "reverse-proxy" | "backend"

export interface RateLimitDecision {
  allowed: boolean
  response?: NextResponse
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

  console.warn(`[rate-limit] ${layer} throttle`, {
    layer,
    scopes,
    retryAfterSeconds: safeRetry,
    path: metadata.path,
    ip: metadata.ip,
    apiKey: maskedApiKey,
  })

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

export interface RateLimitContext {
  ip: string
  apiKey: string | null
}

export function getRateLimitContext(request: NextRequest): RateLimitContext {
  return {
    ip: getClientIp(request),
    apiKey: getApiKey(request),
  }
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

export async function enforceUnifiedRateLimit(
  layer: RateLimitLayer,
  context: RateLimitContext,
  metadata: { path?: string } = {},
): Promise<RateLimitDecision> {
  if (isWhitelistedIp(context.ip)) {
    return { allowed: true }
  }

  const scopes: Array<{ label: string; retryAfterMs: number }> = []

  if (context.ip && context.ip !== "unknown") {
    const ipKey = `edge:rate:ip:${context.ip}`
    const result = consumeLocalBucket(ipKey, RATE_LIMIT_IP_RPS, RATE_LIMIT_INTERVAL_MS, RATE_LIMIT_BURST)
    if (!result.allowed) {
      scopes.push({ label: "ip", retryAfterMs: result.retryAfterMs })
    }
  }

  if (context.apiKey) {
    const apiKeyKey = `edge:rate:api:${context.apiKey}`
    const result = consumeLocalBucket(apiKeyKey, RATE_LIMIT_API_KEY_RPS, RATE_LIMIT_INTERVAL_MS, RATE_LIMIT_BURST)
    if (!result.allowed) {
      scopes.push({ label: "api-key", retryAfterMs: result.retryAfterMs })
    }
  }

  if (scopes.length === 0) {
    return { allowed: true }
  }

  const retryAfterMs = Math.max(...scopes.map((scope) => scope.retryAfterMs))
  const response = buildThrottleResponse(layer, scopes.map((scope) => scope.label), retryAfterMs / 1000, {
    ip: context.ip,
    apiKey: context.apiKey,
    path: metadata.path,
  })

  return { allowed: false, response }
}
