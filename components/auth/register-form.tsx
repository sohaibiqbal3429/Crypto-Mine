"use client"

import { type FormEvent, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, RefreshCw, UserPlus } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
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
import { formatOTPSuccessMessage, type OTPSuccessPayload } from "@/lib/utils/otp-messages"

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

        const data = (await response.json().catch(() => ({}))) as OTPSuccessPayload & { error?: string }

        if (!response.ok) {
          setError(data.error || "Failed to send verification code")
          return
        }

        setInfoMessage(
          formatOTPSuccessMessage(
            data,
            "Verification code sent to your email. Enter it below to verify your account.",
          ),
        )
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

      const data = (await response.json().catch(() => ({}))) as OTPSuccessPayload & { error?: string }

      if (!response.ok) {
        setError(data.error || "Failed to resend code")
        return
      }

      setInfoMessage(formatOTPSuccessMessage(data, "A new verification code has been sent to your email."))
      setOtpValue("")
      setOtpCountdown(60)
    } catch (resendError) {
      console.error("Resend OTP error", resendError)
      setError("Network error. Please try again.")
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-border/70 bg-card shadow-xl shadow-primary/10 transition-colors">
      <div className="bg-gradient-to-r from-primary to-accent py-4 text-center text-primary-foreground">
        <h1 className="text-lg font-semibold tracking-wide">Referral Signup System</h1>
      </div>

      <div className="space-y-6 px-6 py-6 sm:px-8">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border/60 bg-background/80 text-primary shadow-sm">
            <UserPlus className="h-8 w-8" />
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {infoMessage && (
          <Alert>
            <AlertDescription>{infoMessage}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold text-foreground/90">
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
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-foreground/90">
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
                className="h-11"
                disabled={step === "otp"}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-semibold text-foreground/90">
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
                <SelectTrigger className="h-11 rounded-md sm:w-40">
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
                className="h-11 flex-1"
                disabled={step === "otp"}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Include your full phone number. Country code is added automatically.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold text-foreground/90">
                Password
              </Label>
              <PasswordInput
                id="password"
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
                className="h-11"
                disabled={step === "otp"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-semibold text-foreground/90">
                Re-enter Password
              </Label>
              <PasswordInput
                id="confirmPassword"
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
                className="h-11"
                disabled={step === "otp"}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="referralCode" className="text-sm font-semibold text-foreground/90">
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
              disabled={step === "otp"}
            />
          </div>

          {step === "otp" && (
            <div className="space-y-3">
              <div className="space-y-2 text-center">
                <Label className="text-sm font-semibold text-foreground/90">Enter the 6-digit code</Label>
                <OTPInput value={otpValue} onChange={setOtpValue} disabled={isLoading} />
              </div>
              <div className="flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground sm:flex-row">
                <span>
                  {otpCountdown > 0 ? `You can request a new code in ${otpCountdown}s` : "Didn't get the code?"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResendOTP}
                  disabled={isResending || otpCountdown > 0}
                  className="h-8 px-2"
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
            {step === "details" && (
              <Button type="button" variant="outline" className="h-11 sm:w-auto" onClick={() => router.push("/auth/forgot")}>
                Forgot Password?
              </Button>
            )}

            <Button type="submit" className="h-11 flex-1 sm:flex-none shadow-lg shadow-primary/20" disabled={isLoading}>
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

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/auth/login" className="font-semibold text-primary hover:underline">
            Login instead
          </Link>
        </p>
      </div>
    </div>
  )
}
