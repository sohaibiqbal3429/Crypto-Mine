import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto"

const ENCRYPTION_ALGORITHM = "aes-256-gcm"
const ENCRYPTION_PREFIX = "enc.v1"
const AUTH_TAG_LENGTH = 16
const IV_LENGTH = 12

let cachedKey: Buffer | null | undefined

function resolveEncryptionKey(): Buffer | null {
  if (cachedKey !== undefined) {
    return cachedKey
  }

  const raw = process.env.APP_SETTINGS_ENCRYPTION_KEY
  if (!raw) {
    cachedKey = null
    return cachedKey
  }

  const key = createHash("sha256").update(raw).digest()
  cachedKey = key
  return key
}

export function encryptString(value: string): { payload: string; encrypted: boolean } {
  const key = resolveEncryptionKey()
  if (!key) {
    return { payload: value, encrypted: false }
  }

  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()

  const payload = Buffer.concat([iv, authTag, encrypted]).toString("base64")
  return { payload: `${ENCRYPTION_PREFIX}:${payload}`, encrypted: true }
}

export function decryptString(stored: string): string {
  if (!stored.startsWith(`${ENCRYPTION_PREFIX}:`)) {
    return stored
  }

  const key = resolveEncryptionKey()
  if (!key) {
    throw new Error("APP_SETTINGS_ENCRYPTION_KEY is required to decrypt stored values")
  }

  const payload = stored.slice(ENCRYPTION_PREFIX.length + 1)
  const buffer = Buffer.from(payload, "base64")

  const iv = buffer.subarray(0, IV_LENGTH)
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString("utf8")
}

export function resetEncryptionCache() {
  cachedKey = undefined
}
