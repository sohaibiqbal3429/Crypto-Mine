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

export function formatPhoneNumber(phone: string, countryCode: string): string {
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, "")

  // Add country code if not present
  if (!cleaned.startsWith(countryCode.replace("+", ""))) {
    return `${countryCode}${cleaned}`
  }

  return `+${cleaned}`
}

export function validatePhoneNumber(phone: string): { isValid: boolean; country?: string } {
  const cleaned = phone.replace(/\D/g, "")

  // Pakistan: +92 (11 digits total)
  if (cleaned.startsWith("92") && cleaned.length === 12) {
    return { isValid: true, country: "Pakistan" }
  }

  // China: +86 (11 digits total)
  if (cleaned.startsWith("86") && cleaned.length === 13) {
    return { isValid: true, country: "China" }
  }

  // India: +91 (10 digits total)
  if (cleaned.startsWith("91") && cleaned.length === 12) {
    return { isValid: true, country: "India" }
  }

  return { isValid: false }
}
