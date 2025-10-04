"use client"

import { type FormEvent, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, RefreshCw, UserPlus } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SORTED_COUNTRY_DIAL_CODES } from "@/lib/constants/country-codes"
import { OTPInput } from "@/components/auth/otp-input"

const PHONE_REGEX = /^\+[1-9]\d{7,14}$/

interface RegisterFormData {
  name: string
  email: string
  countryCode: string
  phone: string
  password: string
  confirmPassword: string
  referralCode: string
}

export function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [formData, setFormData] = useState<RegisterFormData>({
    name: "",
    email: "",
    countryCode: "+1",
    phone: "",
    password: "",
    confirmPassword: "",
    referralCode: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [infoMessage, setInfoMessage] = useState("")
  const [step, setStep] = useState<"details" | "otp">("details")
  const [otpValue, setOtpValue] = useState("")
  const [otpCountdown, setOtpCountdown] = useState(0)
  const [isResending, setIsResending] = useState(false)

  // Prefill referral code from query param (?ref= or ?referral=), once on mount / when URL changes
  useEffect(() => {
    const fromRef = (searchParams.get("ref") || searchParams.get("referral") || "").trim()
    if (fromRef && !formData.referralCode) {
      setFormData((prev) => ({ ...prev, referralCode: fromRef.toUpperCase() }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]) // don't include formData in deps to avoid unnecessary resets

  useEffect(() => {
    if (otpCountdown <= 0) return

    const timer = setInterval(() => {
      setOtpCountdown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => clearInterval(timer)
  }, [otpCountdown])

  const normalizedEmail = useMemo(() => formData.email.trim().toLowerCase(), [formData.email])
  const normalizedPhone = useMemo(() => {
    const cleanedPhone = formData.phone.replace(/\D/g, "")
    return `${formData.countryCode}${cleanedPhone}`
  }, [formData.countryCode, formData.phone])

  const resetOTPState = () => {
    setStep("details")
    setOtpValue("")
    setOtpCountdown(0)
    setIsResending(false)
    setInfoMessage("")
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    if (step !== "otp") {
      setInfoMessage("")
    }

    if (step === "details") {
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match")
        return
      }

      if (!PHONE_REGEX.test(normalizedPhone)) {
        setError("Please enter a valid international phone number")
        return
      }

      setIsLoading(true)

      try {
        const response = await fetch("/api/auth/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: normalizedEmail,
            purpose: "registration",
          }),
        })

        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          setError((data as { error?: string }).error || "Failed to send verification code")
          return
        }

        setInfoMessage("Verification code sent to your email. Enter it below to verify your account.")
        setStep("otp")
        setOtpValue("")
        setOtpCountdown(60)
      } catch (submitError) {
        console.error("Send OTP error", submitError)
        setError("Network error. Please try again.")
      } finally {
        setIsLoading(false)
      }

      return
    }

    if (otpValue.length !== 6) {
      setError("Please enter the 6-digit verification code")
      return
    }

    setIsLoading(true)

    try {
      const verifyResponse = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: otpValue,
          email: normalizedEmail,
          purpose: "registration",
        }),
      })

      const verifyData = await verifyResponse.json().catch(() => ({}))

      if (!verifyResponse.ok) {
        setError((verifyData as { error?: string }).error || "Verification failed")
        return
      }

      const registerResponse = await fetch("/api/auth/register-with-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: normalizedEmail,
          phone: normalizedPhone,
          password: formData.password,
          referralCode: formData.referralCode.trim().toUpperCase(),
          otpCode: otpValue,
        }),
      })

      const registerData = await registerResponse.json().catch(() => ({}))

      if (!registerResponse.ok) {
        setError((registerData as { error?: string }).error || "Registration failed")
        return
      }

      router.push("/dashboard")
    } catch (submitError) {
      console.error("Registration with OTP error", submitError)
      setError("Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendOTP = async () => {
    if (isResending || step !== "otp") return

    setError("")
    setInfoMessage("")
    setIsResending(true)

    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          purpose: "registration",
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError((data as { error?: string }).error || "Failed to resend code")
        return
      }

      setInfoMessage("A new verification code has been sent to your email.")
      setOtpValue("")
      setOtpCountdown(60)
    } catch (resendError) {
      console.error("Resend OTP error", resendError)
      setError("Network error. Please try again.")
    } finally {
      setIsResending(false)
    }
  }

  const inputClasses = "h-12 rounded-xl border-emerald-400/30 bg-black/40"

  return (
    <div className="w-full max-w-3xl overflow-hidden rounded-[2.75rem] border border-white/10 bg-black/60 shadow-[0_25px_80px_rgba(34,197,94,0.22)]">
      <div className="relative overflow-hidden px-10 py-10 text-center text-emerald-950">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/80 via-lime-400/60 to-amber-300/60" />
        <div className="relative space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-950/80">Ignite your orchard identity</p>
          <h1 className="text-2xl font-bold uppercase tracking-[0.2em]">Apple Mine Enrollment</h1>
          <p className="text-sm font-medium text-emerald-950/80">
            Set up your Apple Mine profile to unlock collaborative orchard mining and layered rewards
          </p>
        </div>
      </div>

      <div className="space-y-6 px-8 py-10 sm:px-12">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-400/15 text-emerald-200 shadow-[0_15px_30px_rgba(34,197,94,0.25)]">
            <UserPlus className="h-8 w-8" />
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {infoMessage && (
          <Alert className="border-emerald-400/40 bg-emerald-400/10 text-emerald-100">
            <AlertDescription>{infoMessage}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold text-emerald-100/90">
                Name
              </Label>
              <Input
                id="name"
                placeholder="Enter name"
                value={formData.name}
                onChange={(event) => {
                  setFormData((prev) => ({ ...prev, name: event.target.value }))
                  if (step === "otp") {
                    resetOTPState()
                  }
                }}
                required
                className={inputClasses}
                disabled={step === "otp"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-emerald-100/90">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter email"
                value={formData.email}
                onChange={(event) => {
                  setFormData((prev) => ({ ...prev, email: event.target.value }))
                  if (step === "otp") {
                    resetOTPState()
                  }
                }}
                required
                className={inputClasses}
                disabled={step === "otp"}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-semibold text-emerald-100/90">
              Phone Number
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select
                value={formData.countryCode}
                onValueChange={(value) => {
                  setFormData((prev) => ({ ...prev, countryCode: value }))
                  if (step === "otp") {
                    resetOTPState()
                  }
                }}
                disabled={step === "otp"}
              >
                <SelectTrigger className={`${inputClasses} sm:w-40`}>
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {SORTED_COUNTRY_DIAL_CODES.map((country) => (
                    <SelectItem key={country.isoCode} value={country.dialCode}>
                      {country.name} ({country.dialCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                id="phone"
                inputMode="tel"
                placeholder="123456789"
                value={formData.phone}
                onChange={(event) => {
                  setFormData((prev) => ({ ...prev, phone: event.target.value.replace(/[^\d]/g, "") }))
                  if (step === "otp") {
                    resetOTPState()
                  }
                }}
                required
                className={`${inputClasses} flex-1`}
                disabled={step === "otp"}
              />
            </div>
            <p className="text-xs text-emerald-100/70">Include your full phone number. Country code is added automatically.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold text-emerald-100/90">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={formData.password}
                onChange={(event) => {
                  setFormData((prev) => ({ ...prev, password: event.target.value }))
                  if (step === "otp") {
                    resetOTPState()
                  }
                }}
                required
                minLength={6}
                className={inputClasses}
                disabled={step === "otp"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-semibold text-emerald-100/90">
                Re-enter Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter password"
                value={formData.confirmPassword}
                onChange={(event) => {
                  setFormData((prev) => ({ ...prev, confirmPassword: event.target.value }))
                  if (step === "otp") {
                    resetOTPState()
                  }
                }}
                required
                minLength={6}
                className={inputClasses}
                disabled={step === "otp"}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="referralCode" className="text-sm font-semibold text-emerald-100/90">
              Referral Code
            </Label>
            <Input
              id="referralCode"
              type="text"
              placeholder="Enter referral code (required)"
              value={formData.referralCode}
              onChange={(event) => {
                setFormData((prev) => ({ ...prev, referralCode: event.target.value.toUpperCase() }))
                if (step === "otp") {
                  resetOTPState()
                }
              }}
              required
              className={inputClasses}
              disabled={step === "otp"}
            />
          </div>

          {step === "otp" && (
            <div className="rounded-3xl border border-emerald-400/25 bg-emerald-400/10 p-6">
              <div className="space-y-2 text-center">
                <Label className="text-sm font-semibold text-emerald-100/90">Enter the 6-digit code</Label>
                <OTPInput value={otpValue} onChange={setOtpValue} disabled={isLoading} />
              </div>
              <div className="mt-4 flex flex-col items-center justify-center gap-2 text-xs text-emerald-100/70 sm:flex-row">
                <span>{otpCountdown > 0 ? `You can request a new code in ${otpCountdown}s` : "Didn't get the code?"}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResendOTP}
                  disabled={isResending || otpCountdown > 0}
                  className="h-8 px-3 text-emerald-200 hover:text-emerald-100"
                >
                  {isResending ? (
                    <>
                      <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> Resending...
                    </>
                  ) : (
                    "Resend code"
                  )}
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {step === "details" ? (
              <Link
                href="/auth/forgot"
                className="text-sm font-semibold text-emerald-200 underline-offset-4 hover:text-emerald-100 hover:underline"
              >
                Need to reset your password?
              </Link>
            ) : (
              <p className="text-sm text-emerald-100/70">Check your inbox for the Apple Mine verification code.</p>
            )}

            <Button
              type="submit"
              className="h-12 flex-1 rounded-xl bg-gradient-to-r from-emerald-400 via-lime-400 to-amber-300 text-base font-semibold text-emerald-950 shadow-[0_20px_40px_rgba(34,197,94,0.25)] hover:from-emerald-300 hover:via-lime-300 hover:to-amber-200 sm:flex-none sm:px-8"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {step === "details" ? "Sending Code..." : "Verifying..."}
                </>
              ) : step === "details" ? (
                "Send Verification Code"
              ) : (
                "Verify & Create Account"
              )}
            </Button>
          </div>
        </form>

        <p className="text-center text-sm text-emerald-100/70">
          Already cultivating with Apple Mine?{" "}
          <Link href="/auth/login" className="font-semibold text-emerald-200 underline-offset-4 hover:underline">
            Login instead
          </Link>
        </p>
      </div>
    </div>
  )
}
