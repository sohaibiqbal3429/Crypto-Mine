"use client"

import { type FormEvent, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, LockKeyhole, RefreshCw } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { OTPInput } from "@/components/auth/otp-input"
import { formatOTPSuccessMessage, type OTPSuccessPayload } from "@/lib/utils/otp-messages"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const redirectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [step, setStep] = useState<"request" | "verify" | "reset">("request")
  const [otpValue, setOtpValue] = useState("")
  const [verifiedCode, setVerifiedCode] = useState<string | null>(null)
  const [otpCountdown, setOtpCountdown] = useState(0)
  const [isResending, setIsResending] = useState(false)

  useEffect(() => {
    return () => {
      if (redirectTimeout.current) {
        clearTimeout(redirectTimeout.current)
      }
    }
  }, [])

  useEffect(() => {
    if (otpCountdown <= 0) return

    const timer = setInterval(() => {
      setOtpCountdown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => clearInterval(timer)
  }, [otpCountdown])

  const resetFlow = () => {
    setStep("request")
    setOtpValue("")
    setVerifiedCode(null)
    setOtpCountdown(0)
    setIsResending(false)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")

    if (step === "request") {
      setSuccess("")
      setIsLoading(true)

      try {
        const response = await fetch("/api/auth/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.email.trim().toLowerCase(),
            purpose: "password_reset",
          }),
        })

        const data = (await response.json().catch(() => ({}))) as OTPSuccessPayload & {
          error?: string
          message?: string
        }

        if (!response.ok) {
          setError(data.message || data.error || "Unable to send verification code")
          return
        }

        setSuccess(
          formatOTPSuccessMessage(
            data,
            "Verification code sent to your email. Enter it below to verify your account.",
          ),
        )
        setStep("verify")
        setOtpValue("")
        setOtpCountdown(60)
      } catch (submitError) {
        console.error("Forgot password OTP error", submitError)
        const message = submitError instanceof Error ? submitError.message : "Network error. Please try again."
        setError(message)
      } finally {
        setIsLoading(false)
      }

      return
    }

    if (step === "verify") {
      if (otpValue.length !== 6) {
        setError("Please enter the 6-digit verification code")
        return
      }

      setIsLoading(true)

      try {
        const response = await fetch("/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: otpValue,
            email: formData.email.trim().toLowerCase(),
            purpose: "password_reset",
          }),
        })

        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          setError((data as { message?: string; error?: string }).message || (data as { error?: string }).error || "Verification failed")
          return
        }

        setSuccess("Code verified. Set your new password below.")
        setVerifiedCode(otpValue)
        setStep("reset")
      } catch (verifyError) {
        console.error("Verify OTP error", verifyError)
        const message = verifyError instanceof Error ? verifyError.message : "Network error. Please try again."
        setError(message)
      } finally {
        setIsLoading(false)
      }

      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (!verifiedCode) {
      setError("Verification code is missing. Please verify again.")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          otpCode: verifiedCode,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError((data as { message?: string; error?: string }).message || (data as { error?: string }).error || "Unable to reset password")
        return
      }

      setSuccess("Password updated successfully. Redirecting to login...")
      setFormData({ email: formData.email, password: "", confirmPassword: "" })
      resetFlow()
      redirectTimeout.current = setTimeout(() => {
        router.push("/auth/login")
      }, 1500)
    } catch (error) {
      console.error("Forgot password error", error)
      const message = error instanceof Error ? error.message : "Network error. Please try again."
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendOTP = async () => {
    if (isResending || step === "request") return

    setError("")
    setSuccess("")
    setIsResending(true)

    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase(),
          purpose: "password_reset",
        }),
      })

      const data = (await response.json().catch(() => ({}))) as OTPSuccessPayload & {
        error?: string
        message?: string
      }

      if (!response.ok) {
        setError(data.message || data.error || "Unable to resend verification code")
        return
      }

      setSuccess(formatOTPSuccessMessage(data, "A new verification code has been sent to your email."))
      setOtpValue("")
      setOtpCountdown(60)
      setVerifiedCode(null)
      setStep("verify")
    } catch (resendError) {
      console.error("Resend OTP error", resendError)
      const message = resendError instanceof Error ? resendError.message : "Network error. Please try again."
      setError(message)
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--secondary))] to-[hsl(var(--muted))] p-4 text-foreground transition-colors dark:from-[#050505] dark:via-[#0a0a0a] dark:to-[#141414]">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-border/70 bg-card shadow-xl shadow-primary/10 transition-colors">
        <div className="bg-gradient-to-r from-primary to-accent py-4 text-center text-primary-foreground">
          <h1 className="text-lg font-semibold tracking-wide">Reset Your Password</h1>
        </div>

        <div className="space-y-6 px-6 py-6 sm:px-8">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border/60 bg-background/80 text-primary shadow-sm">
              <LockKeyhole className="h-8 w-8" />
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Reset failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-foreground/90">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your registered email"
                value={formData.email}
                onChange={(event) => {
                  const value = event.target.value
                  setFormData((prev) => ({ ...prev, email: value }))
                  if (step !== "request") {
                    resetFlow()
                  }
                }}
                required
                className="h-11"
                disabled={step !== "request"}
              />
            </div>

            {step !== "request" && (
              <div className="space-y-3">
                <div className="space-y-2 text-center">
                  <Label className="text-sm font-semibold text-foreground/90">Enter the 6-digit code</Label>
                  <OTPInput value={otpValue} onChange={setOtpValue} disabled={isLoading || step === "reset"} />
                </div>
                <div className="flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground sm:flex-row">
                  <span>
                    {otpCountdown > 0 ? `You can request a new code in ${otpCountdown}s` : "Didn't receive the code?"}
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
                        <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> Sending...
                      </>
                    ) : (
                      "Resend code"
                    )}
                  </Button>
                </div>
              </div>
            )}

            {step === "reset" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-semibold text-foreground/90">
                    New Password
                  </Label>
                  <PasswordInput
                    id="password"
                    placeholder="Enter new password"
                    value={formData.password}
                    onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))}
                    required
                    minLength={6}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-semibold text-foreground/90">
                    Confirm Password
                  </Label>
                  <PasswordInput
                    id="confirmPassword"
                    placeholder="Re-enter new password"
                    value={formData.confirmPassword}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, confirmPassword: event.target.value }))
                    }
                    required
                    minLength={6}
                    className="h-11"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <Button type="button" variant="outline" className="h-11 sm:w-auto" onClick={() => router.push("/auth/login")}>
                Back to Login
              </Button>

              <Button type="submit" className="h-11 flex-1 sm:flex-none shadow-lg shadow-primary/20" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {step === "request" ? "Sending Code..." : step === "verify" ? "Verifying..." : "Updating..."}
                  </>
                ) : step === "request" ? (
                  "Send Verification Code"
                ) : step === "verify" ? (
                  "Verify Code"
                ) : (
                  "Reset Password"
                )}
              </Button>
            </div>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Remembered your password?{" "}
            <Link href="/auth/login" className="font-semibold text-primary hover:underline">
              Login here
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
