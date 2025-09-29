import { z } from "zod"

// Phone number validation for supported countries
export const phoneSchema = z.string().refine(
  (phone) => {
    const cleaned = phone.replace(/\D/g, "")

    // Pakistan: +92 (11 digits total)
    if (cleaned.startsWith("92") && cleaned.length === 12) return true

    // China: +86 (11 digits total)
    if (cleaned.startsWith("86") && cleaned.length === 13) return true

    // India: +91 (10 digits total)
    if (cleaned.startsWith("91") && cleaned.length === 12) return true

    return false
  },
  {
    message: "Please enter a valid phone number with country code (+92, +86, or +91)",
  },
)

// Email validation
export const emailSchema = z.string().email("Please enter a valid email address")

// Password validation
export const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    "Password must contain at least one uppercase letter, one lowercase letter, and one number",
  )

// OTP validation
export const otpSchema = z
  .string()
  .length(6, "OTP must be exactly 6 digits")
  .regex(/^\d{6}$/, "OTP must contain only numbers")

// Referral code validation
export const referralCodeSchema = z
  .string()
  .min(6, "Referral code must be at least 6 characters")
  .max(10, "Referral code must be at most 10 characters")
  .regex(/^[A-Z0-9]+$/, "Referral code must contain only uppercase letters and numbers")

// Amount validation for deposits/withdrawals
export const amountSchema = z
  .number()
  .positive("Amount must be positive")
  .min(1, "Minimum amount is $1")
  .max(100000, "Maximum amount is $100,000")

// Validation helper functions
export function validateEmail(email: string): { isValid: boolean; error?: string } {
  try {
    emailSchema.parse(email)
    return { isValid: true }
  } catch (error: any) {
    return { isValid: false, error: error.errors[0]?.message }
  }
}

export function validatePhone(phone: string): { isValid: boolean; error?: string; country?: string } {
  try {
    phoneSchema.parse(phone)
    const cleaned = phone.replace(/\D/g, "")

    let country = ""
    if (cleaned.startsWith("92")) country = "Pakistan"
    else if (cleaned.startsWith("86")) country = "China"
    else if (cleaned.startsWith("91")) country = "India"

    return { isValid: true, country }
  } catch (error: any) {
    return { isValid: false, error: error.errors[0]?.message }
  }
}

export function validatePassword(password: string): {
  isValid: boolean
  error?: string
  strength: "weak" | "medium" | "strong"
} {
  try {
    passwordSchema.parse(password)

    // Calculate password strength
    let strength: "weak" | "medium" | "strong" = "weak"
    if (password.length >= 8 && /(?=.*[!@#$%^&*])/.test(password)) {
      strength = "strong"
    } else if (password.length >= 6) {
      strength = "medium"
    }

    return { isValid: true, strength }
  } catch (error: any) {
    return { isValid: false, error: error.errors[0]?.message, strength: "weak" }
  }
}

export function validateOTP(otp: string): { isValid: boolean; error?: string } {
  try {
    otpSchema.parse(otp)
    return { isValid: true }
  } catch (error: any) {
    return { isValid: false, error: error.errors[0]?.message }
  }
}

export function validateReferralCode(code: string): { isValid: boolean; error?: string } {
  try {
    referralCodeSchema.parse(code)
    return { isValid: true }
  } catch (error: any) {
    return { isValid: false, error: error.errors[0]?.message }
  }
}

export function validateAmount(amount: number): { isValid: boolean; error?: string } {
  try {
    amountSchema.parse(amount)
    return { isValid: true }
  } catch (error: any) {
    return { isValid: false, error: error.errors[0]?.message }
  }
}
