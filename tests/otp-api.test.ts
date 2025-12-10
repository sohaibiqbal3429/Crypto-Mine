import assert from "node:assert/strict"
import test, { mock } from "node:test"

process.env.SEED_IN_MEMORY = "true"
process.env.ENABLE_DEV_OTP_FALLBACK = "true"
process.env.NODE_ENV = "test"

import dbConnect from "@/lib/mongodb"
import OTP from "@/models/OTP"
import User from "@/models/User"
import Balance from "@/models/Balance"
import { comparePassword, hashPassword } from "@/lib/auth"
import { POST as sendOTP } from "@/app/api/auth/send-otp/route"
import { POST as verifyOTP } from "@/app/api/auth/verify-otp/route"
import { POST as registerWithOTP } from "@/app/api/auth/register-with-otp/route"
import { POST as resetPassword } from "@/app/api/auth/reset-password/route"
import { normalizeSMTPError } from "@/lib/utils/smtp-error"
import * as emailUtils from "@/lib/utils/email"

async function callRoute(handler: (req: any) => Promise<any>, body: Record<string, unknown>) {
  const response = await handler({ json: async () => body } as any)
  const data = await response.json()
  return { response, data }
}

test.before(async () => {
  await dbConnect()
})

test.beforeEach(async () => {
  await Promise.all([OTP.deleteMany({}), User.deleteMany({}), Balance.deleteMany({})])
})

test("send-otp stores a fresh code and verify-otp marks it verified", async () => {
  const { response: sendResponse } = await callRoute(sendOTP, {
    email: "TestUser@example.com",
    purpose: "registration",
  })

  assert.equal(sendResponse.status, 200)

  const otpRecord = await OTP.findOne({ email: "testuser@example.com", purpose: "registration" }).sort({ createdAt: -1 })
  assert.ok(otpRecord)

  const { response: verifyResponse } = await callRoute(verifyOTP, {
    code: otpRecord!.code,
    email: "testuser@example.com",
    purpose: "registration",
  })

  assert.equal(verifyResponse.status, 200)

  const updated = await OTP.findById(otpRecord!._id)
  assert.ok(updated?.verified)
  assert.equal(updated?.attempts, 1)
})

test("verify-otp rejects bad or expired codes", async () => {
  const record = await OTP.create({
    email: "bad@example.com",
    code: "111111",
    type: "email",
    purpose: "registration",
    expiresAt: new Date(Date.now() - 60_000),
  })

  const expired = await callRoute(verifyOTP, {
    code: record.code,
    email: "bad@example.com",
    purpose: "registration",
  })
  assert.equal(expired.response.status, 400)

  const shouldBeDeleted = await OTP.findById(record._id)
  assert.equal(shouldBeDeleted, null)

  const fresh = await OTP.create({
    email: "bad@example.com",
    code: "222222",
    type: "email",
    purpose: "registration",
    expiresAt: new Date(Date.now() + 5 * 60_000),
  })

  const invalid = await callRoute(verifyOTP, {
    code: "123123",
    email: "bad@example.com",
    purpose: "registration",
  })

  assert.equal(invalid.response.status, 400)
  const retried = await OTP.findById(fresh._id)
  assert.equal(retried?.attempts, 1)
  assert.equal(retried?.verified, false)
})

test("register-with-otp creates an account after OTP verification", async () => {
  const referrer = await User.create({
    email: "ref@example.com",
    passwordHash: "hash",
    name: "Referrer",
    role: "user",
    referralCode: "REFCODE",
    isActive: true,
  })

  const { response: sendResponse } = await callRoute(sendOTP, {
    email: "newuser@example.com",
    purpose: "registration",
  })
  assert.equal(sendResponse.status, 200)

  const otpRecord = await OTP.findOne({ email: "newuser@example.com", purpose: "registration" })
  assert.ok(otpRecord)

  const verifyResult = await callRoute(verifyOTP, {
    code: otpRecord!.code,
    email: "newuser@example.com",
    purpose: "registration",
  })
  assert.equal(verifyResult.response.status, 200)

  const registerResult = await callRoute(registerWithOTP, {
    name: "New User",
    email: "newuser@example.com",
    password: "S3cret!",
    referralCode: referrer.referralCode,
    otpCode: otpRecord!.code,
    phone: "+12345678901",
  })

  assert.equal(registerResult.response.status, 200)

  const createdUser = await User.findOne({ email: "newuser@example.com" })
  assert.ok(createdUser)
  assert.equal(createdUser?.emailVerified, true)
  assert.equal(createdUser?.phoneVerified, true)

  const balance = await Balance.findOne({ userId: createdUser?._id })
  assert.ok(balance)

  const leftoverOtp = await OTP.findById(otpRecord!._id)
  assert.equal(leftoverOtp, null)
})

test("reset-password uses a verified OTP and clears it after update", async () => {
  const originalHash = await hashPassword("OldPass1")
  const user = await User.create({
    email: "reset@example.com",
    passwordHash: originalHash,
    name: "Reset",
    referralCode: "RESET1",
    isActive: true,
  })

  const { response: sendResponse } = await callRoute(sendOTP, {
    email: "reset@example.com",
    purpose: "password_reset",
  })
  assert.equal(sendResponse.status, 200)

  const otpRecord = await OTP.findOne({ email: "reset@example.com", purpose: "password_reset" })
  assert.ok(otpRecord)

  const verifyResult = await callRoute(verifyOTP, {
    code: otpRecord!.code,
    email: "reset@example.com",
    purpose: "password_reset",
  })
  assert.equal(verifyResult.response.status, 200)

  const resetResult = await callRoute(resetPassword, {
    email: "reset@example.com",
    password: "NewPass1",
    otpCode: otpRecord!.code,
  })

  assert.equal(resetResult.response.status, 200)

  const refreshedUser = await User.findById(user._id)
  assert.ok(refreshedUser)
  assert.notEqual(refreshedUser?.passwordHash, originalHash)
  assert.equal(await comparePassword("NewPass1", refreshedUser!.passwordHash), true)

  const leftoverOtp = await OTP.findById(otpRecord!._id)
  assert.equal(leftoverOtp, null)
})

test("send-otp fails loudly when email config is missing in production mode", async () => {
  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
    ENABLE_DEV_OTP_FALLBACK: process.env.ENABLE_DEV_OTP_FALLBACK,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
  }

  process.env.NODE_ENV = "production"
  process.env.ENABLE_DEV_OTP_FALLBACK = "false"
  delete process.env.SMTP_HOST
  delete process.env.SMTP_PORT
  delete process.env.SMTP_USER
  delete process.env.SMTP_PASS

  try {
    const { response, data } = await callRoute(sendOTP, {
      email: "prod@example.com",
      purpose: "registration",
    })

    assert.equal(response.status, 500)
    assert.equal(data.error, "Email service is not configured. Please contact support.")
  } finally {
    Object.assign(process.env, previousEnv)
  }
})

test("normalizeSMTPError maps common SMTP failures", () => {
  const limitError = normalizeSMTPError({ message: "Daily quota exceeded", responseCode: 421 })
  assert.equal(limitError.code, "SMTP_LIMIT_EXCEEDED")
  assert.equal(limitError.status, 429)

  const authError = normalizeSMTPError({ message: "EAUTH Invalid login", code: "EAUTH" })
  assert.equal(authError.code, "SMTP_AUTH_FAILED")

  const invalidEmailError = normalizeSMTPError({ message: "Invalid recipient", responseCode: 550 })
  assert.equal(invalidEmailError.code, "SMTP_INVALID_EMAIL")

  const connectionError = normalizeSMTPError({ message: "Connection timeout", code: "ETIMEDOUT" })
  assert.equal(connectionError.code, "SMTP_CONNECTION_ERROR")
})

test("send-otp returns structured SMTP errors without exposing sensitive data", async () => {
  const previousEnv = { ...process.env }

  const sendMock = mock.method(emailUtils, "sendOTPEmail", async () => {
    const err = new Error("Daily limit exceeded by provider")
    ;(err as any).code = "ESMTP"
    ;(err as any).responseCode = 421
    throw err
  })

  process.env.NODE_ENV = "production"
  process.env.ENABLE_DEV_OTP_FALLBACK = "false"
  process.env.SKIP_OTP_DELIVERY = "false"
  process.env.SMTP_HOST = "smtp.example.com"
  process.env.SMTP_PORT = "587"
  process.env.SMTP_USER = "user@example.com"
  process.env.SMTP_PASS = "password"

  try {
    const { response, data } = await callRoute(sendOTP, {
      email: "limit@example.com",
      purpose: "registration",
    })

    assert.equal(response.status, 429)
    assert.equal(data.success, false)
    assert.equal(data.code, "SMTP_LIMIT_EXCEEDED")
    assert.equal(
      data.message,
      "You’ve hit the daily email limit. Please try again later or contact support.",
    )
    assert.equal("debug" in data, false)
  } finally {
    sendMock.restore()
    Object.assign(process.env, previousEnv)
  }
})

test("send-otp exposes SMTP debug info in non-production environments", async () => {
  const previousEnv = { ...process.env }

  const sendMock = mock.method(emailUtils, "sendOTPEmail", async () => {
    const err = new Error("Invalid login")
    ;(err as any).code = "EAUTH"
    throw err
  })

  process.env.NODE_ENV = "development"
  process.env.ENABLE_DEV_OTP_FALLBACK = "false"
  process.env.SKIP_OTP_DELIVERY = "false"
  process.env.SMTP_HOST = "smtp.example.com"
  process.env.SMTP_PORT = "587"
  process.env.SMTP_USER = "user@example.com"
  process.env.SMTP_PASS = "password"

  try {
    const { response, data } = await callRoute(sendOTP, {
      email: "authfail@example.com",
      purpose: "registration",
    })

    assert.equal(response.status, 401)
    assert.equal(data.success, false)
    assert.equal(data.code, "SMTP_AUTH_FAILED")
    assert.ok(data.debug)
    assert.equal(data.debug.code, "EAUTH")
  } finally {
    sendMock.restore()
    Object.assign(process.env, previousEnv)
  }
})
