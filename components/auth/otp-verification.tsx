"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Loader2, Mail, Smartphone, RefreshCw } from "lucide-react"

interface OTPVerificationProps {
  email?: string
  phone?: string
  onVerified: () => void
  onBack: () => void
}

export default function OTPVerification({ email, phone, onVerified, onBack }: OTPVerificationProps) {
  const [otp, setOtp] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isResending, setIsResending] = useState(false)
  const [countdown, setCountdown] = useState(60)
  const [canResend, setCanResend] = useState(false)

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else {
      setCanResend(true)
    }
  }, [countdown])

  const handleVerify = async () => {
    if (otp.length !== 6) {
      setError("Please enter the complete 6-digit code")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: otp,
          email,
          phone,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        onVerified()
      } else {
        setError(data.error || "Verification failed")
      }
    } catch (err) {
      setError("Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    setIsResending(true)
    setError("")

    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          phone,
          purpose: "registration",
        }),
      })

      if (response.ok) {
        setCountdown(60)
        setCanResend(false)
        setOtp("")
      } else {
        const data = await response.json()
        setError(data.error || "Failed to resend code")
      }
    } catch (err) {
      setError("Network error. Please try again.")
    } finally {
      setIsResending(false)
    }
  }

  return (
    <Card className="w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-black/60 shadow-[0_20px_45px_rgba(34,197,94,0.25)]">
      <CardHeader className="relative space-y-3 text-center">
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-emerald-400/20 via-lime-400/10 to-amber-300/20" />
        <div className="mx-auto mt-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-400/15 text-3xl">
          🍏
        </div>
        <CardTitle className="text-2xl font-bold text-white">Confirm Your Apple Mine Identity</CardTitle>
        <CardDescription className="text-emerald-100/80">
          We've sent a 6-digit code to {email ? "your email" : "your phone"}
          <br />
          <span className="font-medium text-white/90">{email || phone}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={otp} onChange={(value) => setOtp(value)}>
              <InputOTPGroup className="gap-3">
                <InputOTPSlot index={0} className="h-14 w-12 rounded-xl border-emerald-400/40 bg-black/40 text-xl" />
                <InputOTPSlot index={1} className="h-14 w-12 rounded-xl border-emerald-400/40 bg-black/40 text-xl" />
                <InputOTPSlot index={2} className="h-14 w-12 rounded-xl border-emerald-400/40 bg-black/40 text-xl" />
                <InputOTPSlot index={3} className="h-14 w-12 rounded-xl border-emerald-400/40 bg-black/40 text-xl" />
                <InputOTPSlot index={4} className="h-14 w-12 rounded-xl border-emerald-400/40 bg-black/40 text-xl" />
                <InputOTPSlot index={5} className="h-14 w-12 rounded-xl border-emerald-400/40 bg-black/40 text-xl" />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button
            onClick={handleVerify}
            className="h-12 w-full rounded-xl bg-gradient-to-r from-emerald-400 via-lime-400 to-amber-300 text-base font-semibold text-emerald-950 shadow-[0_12px_24px_rgba(34,197,94,0.25)] hover:from-emerald-300 hover:via-lime-300 hover:to-amber-200"
            disabled={isLoading || otp.length !== 6}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify Code"
            )}
          </Button>
        </div>

        <div className="space-y-2 text-center">
          <p className="text-sm text-emerald-100/70">Didn't receive the code?</p>
          <Button
            variant="ghost"
            onClick={handleResend}
            disabled={!canResend || isResending}
            className="text-sm text-emerald-200 hover:text-emerald-100"
          >
            {isResending ? (
              <>
                <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                Sending...
              </>
            ) : canResend ? (
              <>
                {email ? <Mail className="mr-2 h-3 w-3" /> : <Smartphone className="mr-2 h-3 w-3" />}
                Resend Code
              </>
            ) : (
              `Resend in ${countdown}s`
            )}
          </Button>
        </div>
        <Button
          variant="outline"
          onClick={onBack}
          className="h-12 w-full rounded-xl border-emerald-400/40 bg-transparent text-emerald-100 hover:bg-emerald-400/10"
        >
          Back to Registration
        </Button>
      </CardContent>
    </Card>
  )
}
