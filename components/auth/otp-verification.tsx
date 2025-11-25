"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Loader2, Mail, Smartphone, RefreshCw } from "lucide-react"
import Image from "next/image"
import { formatOTPSuccessMessage, type OTPSuccessPayload } from "@/lib/utils/otp-messages"

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
  const [infoMessage, setInfoMessage] = useState("")

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
    setInfoMessage("")

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

      const data = (await response.json().catch(() => ({}))) as OTPSuccessPayload & { error?: string }

      if (response.ok) {
        setCountdown(60)
        setCanResend(false)
        setOtp("")
        setInfoMessage(formatOTPSuccessMessage(data, "A new verification code has been sent."))
      } else {
        setError(data.error || "Failed to resend code")
      }
    } catch (err) {
      setError("Network error. Please try again.")
    } finally {
      setIsResending(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 w-16 h-16 relative">
          <Image src="/images/mintmine-logo.png" alt="Mintmine Pro" fill className="object-contain" />
        </div>
        <CardTitle className="text-2xl font-bold">Verify Your Account</CardTitle>
        <CardDescription>
          We've sent a 6-digit code to {email ? "your email" : "your phone"}
          <br />
          <span className="font-medium text-foreground">{email || phone}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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

        <div className="space-y-4">
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={otp} onChange={(value) => setOtp(value)}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button onClick={handleVerify} className="w-full" disabled={isLoading || otp.length !== 6}>
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

        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">Didn't receive the code?</p>
          <Button variant="ghost" onClick={handleResend} disabled={!canResend || isResending} className="text-sm">
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

        <Button variant="outline" onClick={onBack} className="w-full bg-transparent">
          Back to Registration
        </Button>
      </CardContent>
    </Card>
  )
}
