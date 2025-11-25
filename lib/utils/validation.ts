import { z } from "zod"

// Phone number validation (E.164 format)
export const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, "Please enter a valid international phone number (e.g. +15551234567)")

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

export function validatePhone(phone: string): { isValid: boolean; error?: string } {
  try {
    phoneSchema.parse(phone)
    return { isValid: true }
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
