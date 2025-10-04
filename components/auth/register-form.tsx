"use client"

import { type FormEvent, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, RefreshCw, Sparkle, UserPlus } from "lucide-react"

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

  useEffect(() => {
    const fromRef = (searchParams.get("ref") || searchParams.get("referral") || "").trim()
    if (fromRef && !formData.referralCode) {
      setFormData((prev) => ({ ...prev, referralCode: fromRef.toUpperCase() }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

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

        setInfoMessage("Verification code sent. Enter the 6-digit code to finalise your Apple Mine ident.")
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

      setInfoMessage("Another code is en route. Check your inbox and enter the new digits.")
      setOtpCountdown(60)
      setOtpValue("")
    } catch (error) {
      console.error("Resend OTP error", error)
      setError("Network error. Please try again.")
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-[2.75rem] border border-white/15 bg-black/50 shadow-[0_35px_100px_rgba(14,165,233,0.28)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(165,243,252,0.2),_transparent_60%)]" />
      <div className="absolute inset-x-8 top-8 h-44 rounded-[2.5rem] bg-gradient-to-r from-cyan-300/30 via-sky-400/25 to-fuchsia-400/30 blur-3xl" />
      <div className="relative space-y-8 px-8 pb-12 pt-12 sm:px-10">
        <div className="flex flex-col items-center gap-3 text-center text-white">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-3xl text-white">
            <UserPlus className="h-8 w-8" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.45em] text-cyan-100/70">Initiation</p>
          <h2 className="text-3xl font-bold">Apple Mine Identity Setup</h2>
          <p className="max-w-xl text-sm text-white/70">
            We engineered this flow exclusively for Apple Mine. Provide your details, confirm with a bespoke OTP ritual, and unlock luminous dashboards immediately.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {infoMessage && !error && (
          <Alert>
            <AlertDescription>{infoMessage}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-8 text-white">
          {step === "details" ? (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-semibold text-white/80">
                    Full Name
                  </Label>
                  <Input
                    id="name"
                    placeholder="Enter your name"
                    value={formData.name}
                    onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                    className="h-12 rounded-2xl border-white/20 bg-white/10 text-white placeholder:text-white/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold text-white/80">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@domain.com"
                    value={formData.email}
                    onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                    className="h-12 rounded-2xl border-white/20 bg-white/10 text-white placeholder:text-white/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country" className="text-sm font-semibold text-white/80">
                    Country Code
                  </Label>
                  <Select
                    value={formData.countryCode}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, countryCode: value }))}
                  >
                    <SelectTrigger className="h-12 rounded-2xl border-white/20 bg-white/10 text-white">
                      <SelectValue placeholder="Select code" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {SORTED_COUNTRY_DIAL_CODES.map((country) => (
                        <SelectItem key={country.isoCode} value={country.dialCode}>
                          {country.name} ({country.dialCode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-semibold text-white/80">
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    inputMode="tel"
                    placeholder="123456789"
                    value={formData.phone}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, phone: event.target.value.replace(/[^\d]/g, "") }))
                    }
                    className="h-12 rounded-2xl border-white/20 bg-white/10 text-white placeholder:text-white/40"
                  />
                  <p className="text-xs text-white/60">Include the full number linked to your mining wallet.</p>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-semibold text-white/80">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Create a passphrase"
                    value={formData.password}
                    onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))}
                    className="h-12 rounded-2xl border-white/20 bg-white/10 text-white placeholder:text-white/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-semibold text-white/80">
                    Confirm Password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Repeat your passphrase"
                    value={formData.confirmPassword}
                    onChange={(event) => setFormData((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                    className="h-12 rounded-2xl border-white/20 bg-white/10 text-white placeholder:text-white/40"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="referralCode" className="text-sm font-semibold text-white/80">
                  Referral Code (optional)
                </Label>
                <Input
                  id="referralCode"
                  placeholder="Enter referral code"
                  value={formData.referralCode}
                  onChange={(event) => setFormData((prev) => ({ ...prev, referralCode: event.target.value.toUpperCase() }))}
                  className="h-12 rounded-2xl border-white/20 bg-white/10 text-white placeholder:text-white/40"
                />
                <p className="text-xs text-white/60">Sharing a code links you to alliance bonuses from day one.</p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <Link href="/auth/login" className="text-sm font-medium text-cyan-100/80 hover:text-cyan-100">
                  Already initiated? Sign in
                </Link>
                <Button
                  type="submit"
                  className="h-12 w-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-fuchsia-500 text-base font-semibold text-slate-900 shadow-lg shadow-cyan-500/30 hover:from-cyan-300 hover:via-sky-300 hover:to-fuchsia-400 sm:w-auto"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending code…
                    </>
                  ) : (
                    <>
                      <Sparkle className="mr-2 h-4 w-4" /> Send Verification Code
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-8">
              <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 text-center text-sm text-white/70">
                Enter the six digits sent to <span className="font-semibold text-white">{normalizedEmail}</span>. This ritual links your identity to the Apple Mine habitat.
              </div>

              <div className="flex justify-center">
                <OTPInput value={otpValue} onChange={setOtpValue} />
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={resetOTPState}
                  className="text-sm text-white hover:text-cyan-100"
                >
                  ← Edit account details
                </Button>
                <Button
                  type="submit"
                  className="h-12 w-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-fuchsia-500 text-base font-semibold text-slate-900 shadow-lg shadow-cyan-500/30 hover:from-cyan-300 hover:via-sky-300 hover:to-fuchsia-400 sm:w-auto"
                  disabled={isLoading || otpValue.length !== 6}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying…
                    </>
                  ) : (
                    "Activate Habitat"
                  )}
                </Button>
              </div>

              <div className="flex flex-col items-center justify-between gap-3 rounded-[1.75rem] border border-white/10 bg-white/5 px-5 py-4 text-xs text-white/70 sm:flex-row sm:text-left">
                <span>
                  {otpCountdown > 0
                    ? `Resend available in ${otpCountdown}s`
                    : "Need a fresh code?"}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResendOTP}
                  disabled={otpCountdown > 0 || isResending}
                  className="h-9 rounded-full border-white/30 bg-transparent px-4 text-xs font-semibold text-white hover:bg-white/10"
                >
                  {isResending ? (
                    <>
                      <RefreshCw className="mr-2 h-3 w-3 animate-spin" /> Sending…
                    </>
                  ) : (
                    "Resend Code"
                  )}
                </Button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
