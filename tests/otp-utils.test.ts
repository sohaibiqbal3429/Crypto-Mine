import assert from "node:assert/strict"
import test from "node:test"

import {
  formatPhoneNumber,
  generateOTP,
  getOTPExpiry,
  isOTPExpired,
  normalizeEmail,
  normalizePhoneNumber,
} from "@/lib/utils/otp"

test("generateOTP creates numeric 6-digit codes", () => {
  const codes = [generateOTP(), generateOTP(), generateOTP()]
  for (const code of codes) {
    assert.equal(code.length, 6)
    assert.match(code, /^\d{6}$/u)
  }

  assert.ok(new Set(codes).size >= 2)
})

test("OTP expiry helpers behave as expected", () => {
  const shortExpiry = getOTPExpiry(0.001)
  assert.ok(shortExpiry > new Date())

  const expired = new Date(Date.now() - 1_000)
  assert.equal(isOTPExpired(expired), true)

  const future = getOTPExpiry(5)
  assert.equal(isOTPExpired(future), false)
})

test("contact normalization trims and lowercases", () => {
  assert.equal(normalizeEmail(" Test@Example.COM "), "test@example.com")
  assert.equal(normalizeEmail(undefined), undefined)

  assert.equal(formatPhoneNumber(" (415) 555-0000 "), "+4155550000")
  assert.equal(normalizePhoneNumber(" +1 (415) 555-0000 "), "+14155550000")
})
