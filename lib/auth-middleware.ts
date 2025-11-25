import type { NextRequest } from "next/server"

export interface MiddlewareJWTPayload {
  userId: string
  email: string
  role: string
}

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "your-secret-key"
const encoder = new TextEncoder()
const decoder = new TextDecoder()

let cachedKey: CryptoKey | null = null

function base64UrlToUint8Array(input: string): Uint8Array {
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/")
  const padding = base64.length % 4
  if (padding === 2) {
    base64 += "=="
  } else if (padding === 3) {
    base64 += "="
  } else if (padding === 1) {
    base64 += "==="
  }

  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function getSigningKey(): Promise<CryptoKey> {
  if (cachedKey) {
    return cachedKey
  }

  const key = await crypto.subtle.importKey("raw", encoder.encode(JWT_SECRET), {
    name: "HMAC",
    hash: "SHA-256",
  }, false, ["sign", "verify"])

  cachedKey = key
  return key
}

function decodePayload(payloadSegment: string): Record<string, unknown> | null {
  try {
    const payloadBytes = base64UrlToUint8Array(payloadSegment)
    const json = decoder.decode(payloadBytes)
    const parsed = JSON.parse(json)
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>
    }
  } catch (error) {
    console.warn("[auth] Failed to decode JWT payload", error)
  }
  return null
}

async function verifySignature(data: string, signatureSegment: string): Promise<boolean> {
  try {
    const key = await getSigningKey()
    const signature = base64UrlToUint8Array(signatureSegment)
    return crypto.subtle.verify("HMAC", key, signature, encoder.encode(data))
  } catch (error) {
    console.warn("[auth] Failed to verify JWT signature", error)
    return false
  }
}

async function verifyToken(token: string): Promise<MiddlewareJWTPayload | null> {
  const parts = token.split(".")
  if (parts.length !== 3) {
    return null
  }

  const [headerSegment, payloadSegment, signatureSegment] = parts
  const payload = decodePayload(payloadSegment)
  if (!payload) {
    return null
  }

  const now = Math.floor(Date.now() / 1000)
  const exp = typeof payload.exp === "number" ? payload.exp : undefined
  const nbf = typeof payload.nbf === "number" ? payload.nbf : undefined

  if ((exp && now >= exp) || (nbf && now < nbf)) {
    return null
  }

  const data = `${headerSegment}.${payloadSegment}`
  const validSignature = await verifySignature(data, signatureSegment)
  if (!validSignature) {
    return null
  }

  const userId = payload.userId
  const email = payload.email
  const role = payload.role

  if (typeof userId === "string" && typeof email === "string" && typeof role === "string") {
    return { userId, email, role }
  }

  return null
}

export function getTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization")
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7)
  }

  const token = request.cookies.get("auth-token")?.value
  return token || null
}

export async function getUserFromRequest(request: NextRequest): Promise<MiddlewareJWTPayload | null> {
  const token = getTokenFromRequest(request)
  if (!token) {
    return null
  }

  return verifyToken(token)
}
