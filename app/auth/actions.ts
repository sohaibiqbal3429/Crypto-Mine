"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Balance from "@/models/Balance"
import { loginSchema, registerSchema } from "@/lib/validations/auth"
import { comparePassword, hashPassword, signToken } from "@/lib/auth"
import { generateReferralCode } from "@/lib/utils/referral"

export interface AuthFormState {
  error?: string | null
}

function normalizePhone(countryCode: string, phone: string) {
  const codeDigits = countryCode.replace(/[^0-9]/g, "")
  const phoneDigits = phone.replace(/[^0-9]/g, "")
  if (!codeDigits || !phoneDigits) return ""
  return `+${codeDigits}${phoneDigits}`
}

export async function loginAction(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") || "").trim()
  const phoneCountry = String(formData.get("phoneCountry") || "").trim()
  const phoneInput = String(formData.get("phone") || "").trim()
  const password = String(formData.get("password") || "")

  const normalizedPhone = phoneCountry && phoneInput ? normalizePhone(phoneCountry, phoneInput) : ""

  const parsed = loginSchema.safeParse({
    email: email || undefined,
    phone: normalizedPhone || undefined,
    password,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please provide valid credentials" }
  }

  await dbConnect()

  let user = null
  if (parsed.data.email) {
    user = await User.findOne({ email: parsed.data.email })
  }

  if (!user && parsed.data.phone) {
    user = await User.findOne({ phone: parsed.data.phone })
  }

  if (!user) {
    return { error: "Invalid credentials" }
  }

  const isValidPassword = await comparePassword(parsed.data.password, user.passwordHash)
  if (!isValidPassword) {
    return { error: "Invalid credentials" }
  }

  const token = signToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  })

  const cookieStore = await cookies()
  cookieStore.set("auth-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
  })

  redirect("/dashboard")
}

export async function registerAction(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const rawData = {
    name: String(formData.get("name") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    phone: "",
    password: String(formData.get("password") || ""),
    referralCode: String(formData.get("referralCode") || "").trim().toUpperCase(),
  }

  const phoneCountry = String(formData.get("phoneCountry") || "").trim()
  const phoneInput = String(formData.get("phone") || "").trim()
  rawData.phone = normalizePhone(phoneCountry, phoneInput)

  const confirmPassword = String(formData.get("confirmPassword") || "")

  if (rawData.password !== confirmPassword) {
    return { error: "Passwords do not match" }
  }

  const parsed = registerSchema.safeParse(rawData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please review the form and try again" }
  }

  await dbConnect()

  const existingUser = await User.findOne({ $or: [{ email: parsed.data.email }, { phone: parsed.data.phone }] })
  if (existingUser) {
    return { error: "An account with this email or phone already exists" }
  }

  const referrer = await User.findOne({ referralCode: parsed.data.referralCode })
  if (!referrer) {
    return { error: "Invalid referral code" }
  }

  let newReferralCode: string
  do {
    newReferralCode = generateReferralCode()
  } while (await User.findOne({ referralCode: newReferralCode }))

  const passwordHash = await hashPassword(parsed.data.password)

  const user = await User.create({
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    passwordHash,
    referralCode: newReferralCode,
    referredBy: referrer._id,
  })

  await Balance.create({ userId: user._id })

  const token = signToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  })

  const cookieStore = await cookies()
  cookieStore.set("auth-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
  })

  redirect("/dashboard")
}
