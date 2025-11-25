import crypto from "crypto"

export function generateOTP(length = 6): string {
  const digits = "0123456789"
  let otp = ""

  for (let i = 0; i < length; i++) {
    otp += digits[crypto.randomInt(0, digits.length)]
  }

  return otp
}

export function getOTPExpiry(minutes = 10): Date {
  return new Date(Date.now() + minutes * 60 * 1000)
}

export function isOTPExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt
}

export function normalizeEmail(email: string | undefined | null): string | undefined {
  if (!email) return undefined
  const trimmed = email.trim()
  return trimmed ? trimmed.toLowerCase() : undefined
}

const E164_REGEX = /^\+[1-9]\d{7,14}$/

export function formatPhoneNumber(phone: string): string {
  const trimmed = phone.trim()
  if (trimmed.startsWith("+")) {
    return `+${trimmed.replace(/[^\d]/g, "")}`
  }

  return `+${trimmed.replace(/[^\d]/g, "")}`
}

export function validatePhoneNumber(phone: string): { isValid: boolean } {
  const formatted = formatPhoneNumber(phone)

  if (E164_REGEX.test(formatted)) {
    return { isValid: true }
  }

  return { isValid: false }
}

export function normalizePhoneNumber(phone: string | undefined | null): string | undefined {
  if (!phone) return undefined
  const cleaned = formatPhoneNumber(phone)
  return cleaned || undefined
}
