"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Loader2, Mail, RefreshCw, Smartphone } from "lucide-react"

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
    }

    setCanResend(true)
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
    <Card className="w-full max-w-lg overflow-hidden rounded-[2.5rem] border border-white/15 bg-black/50 shadow-[0_30px_90px_rgba(59,130,246,0.25)]">
      <CardHeader className="relative space-y-4 text-center text-white">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(125,211,252,0.25),_transparent_70%)]" />
        <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-2xl">
          🍏
        </div>
        <CardTitle className="text-3xl font-bold">Verify your Apple Mine ritual</CardTitle>
        <CardDescription className="text-white/70">
          {email ? "We sent a code to" : "We sent a code via SMS to"}{" "}
          <span className="font-semibold text-white">{email || phone}</span>. Enter it below to activate your habitat.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 text-white">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-center">
          <InputOTP maxLength={6} value={otp} onChange={(value) => setOtp(value)}>
            <InputOTPGroup className="gap-4">
              {[0, 1, 2, 3, 4, 5].map((slot) => (
                <InputOTPSlot key={slot} index={slot} className="h-14 w-12 rounded-2xl border-white/20 bg-white/10 text-xl text-white" />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        <Button
          onClick={handleVerify}
          className="h-12 w-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-fuchsia-500 text-base font-semibold text-slate-900 shadow-lg shadow-cyan-500/30 hover:from-cyan-300 hover:via-sky-300 hover:to-fuchsia-400"
          disabled={isLoading || otp.length !== 6}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…
            </>
          ) : (
            "Complete Ritual"
          )}
        </Button>

        <div className="space-y-2 text-center text-sm text-white/70">
          <p>Didn&apos;t catch the signal?</p>
          <Button
            variant="ghost"
            onClick={handleResend}
            disabled={!canResend || isResending}
            className="inline-flex items-center justify-center gap-2 text-sm text-white hover:text-cyan-100"
          >
            {isResending ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" /> Sending…
              </>
            ) : canResend ? (
              <>
                {email ? <Mail className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                Resend code
              </>
            ) : (
              `Resend in ${countdown}s`
            )}
          </Button>
        </div>

        <Button
          variant="outline"
          onClick={onBack}
          className="h-12 w-full rounded-full border-white/30 bg-transparent text-white hover:bg-white/10"
        >
          Back to details
        </Button>
      </CardContent>
    </Card>
  )
}
