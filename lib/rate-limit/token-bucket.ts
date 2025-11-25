import type Redis from "ioredis"

import { getRedisClient } from "@/lib/redis"
import { TOKEN_BUCKET_LUA } from "@/lib/redis/scripts/tokenBucket"

let tokenBucketSha: string | null = null

export interface TokenBucketOptions {
  key: string
  tokensPerInterval: number
  intervalMs: number
  maxTokens?: number
  requestedTokens?: number
  client?: Redis
}

export interface TokenBucketResult {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

async function loadScript(client: Redis): Promise<string> {
  if (tokenBucketSha) {
    return tokenBucketSha
  }

  tokenBucketSha = await client.script("load", TOKEN_BUCKET_LUA)
  return tokenBucketSha
}

async function executeScript(
  client: Redis,
  key: string,
  intervalMs: number,
  tokensPerInterval: number,
  maxTokens: number,
  requestedTokens: number,
): Promise<[number, number, number]> {
  const sha = await loadScript(client)

  try {
    return (await client.evalsha(
      sha,
      1,
      key,
      Date.now(),
      intervalMs,
      tokensPerInterval,
      maxTokens,
      requestedTokens,
    )) as [number, number, number]
  } catch (error: any) {
    if (error?.message && error.message.includes("NOSCRIPT")) {
      tokenBucketSha = null
      const freshSha = await loadScript(client)
      return (await client.evalsha(
        freshSha,
        1,
        key,
        Date.now(),
        intervalMs,
        tokensPerInterval,
        maxTokens,
        requestedTokens,
      )) as [number, number, number]
    }

    throw error
  }
}

export async function consumeTokenBucket(options: TokenBucketOptions): Promise<TokenBucketResult> {
  const client = options.client ?? getRedisClient()
  const tokensPerInterval = Math.max(1, Math.floor(options.tokensPerInterval))
  const intervalMs = Math.max(1, Math.floor(options.intervalMs))
  const maxTokens = Math.max(tokensPerInterval, Math.floor(options.maxTokens ?? tokensPerInterval))
  const requestedTokens = Math.max(1, Math.floor(options.requestedTokens ?? 1))

  const response = await executeScript(
    client,
    options.key,
    intervalMs,
    tokensPerInterval,
    maxTokens,
    requestedTokens,
  )

  return {
    allowed: response[0] === 1,
    remaining: response[1],
    retryAfterMs: response[2],
  }
}
