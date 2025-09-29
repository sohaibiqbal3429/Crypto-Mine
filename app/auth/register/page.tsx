"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ContactMethodSelector } from "@/components/auth/contact-method-selector"
import { UserPlus, ArrowRight } from "lucide-react"

type RegistrationStep = "contact" | "details" | "verification"

export default function RegisterPage() {
  const [step, setStep] = useState<RegistrationStep>("contact")
  const [contactData, setContactData] = useState<{
    email?: string
    phone?: string
    method: "email" | "phone"
  } | null>(null)

  const [formData, setFormData] = useState({
    name: "",
    password: "",
    referralCode: "",
  })

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleContactSubmit = async (data: { email?: string; phone?: string; method: "email" | "phone" }) => {
    setIsLoading(true)
    setError("")

    try {
      console.log("[v0] Submitting contact data:", data)

      // Send OTP to the provided contact method
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          phone: data.phone,
          purpose: "registration",
        }),
      })

      console.log("[v0] Response status:", response.status)
      const result = await response.json()
      console.log("[v0] Response data:", result)

      if (response.ok) {
        setContactData(data)
        setStep("details")
        if (result.developmentOTP) {
          setError(`Development Mode - Your OTP is: ${result.developmentOTP}`)
        }
      } else {
        setError(result.error || "Failed to send verification code")
      }
    } catch (err) {
      console.error("[v0] Network error:", err)
      setError("Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!contactData) {
      setError("Contact information missing")
      return
    }

    // Redirect to OTP verification with form data stored in URL params
    const params = new URLSearchParams({
      purpose: "registration",
      name: formData.name,
      password: formData.password,
      referralCode: formData.referralCode,
    })

    if (contactData.email) params.set("email", contactData.email)
    if (contactData.phone) params.set("phone", contactData.phone)

    router.push(`/auth/verify-otp?${params.toString()}`)
  }

  const renderContactStep = () => (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center">
          <UserPlus className="w-8 h-8 text-white" />
        </div>
        <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
        <CardDescription>Choose how you'd like to verify your account</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <ContactMethodSelector onSubmit={handleContactSubmit} isLoading={isLoading} error={error} />

        <div className="mt-6 text-center text-sm">
          <span className="text-muted-foreground">Already have an account? </span>
          <Link href="/auth/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  )

  const renderDetailsStep = () => (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center">
          <UserPlus className="w-8 h-8 text-white" />
        </div>
        <CardTitle className="text-2xl font-bold">Complete Registration</CardTitle>
        <CardDescription>
          Verification code sent to{" "}
          <span className="font-medium text-foreground">{contactData?.email || contactData?.phone}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleDetailsSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Enter your full name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Create a password (min 6 characters)"
              value={formData.password}
              onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="referralCode">Referral Code</Label>
            <Input
              id="referralCode"
              type="text"
              placeholder="Enter referral code (required)"
              value={formData.referralCode}
              onChange={(e) => setFormData((prev) => ({ ...prev, referralCode: e.target.value.toUpperCase() }))}
              required
            />
          </div>

          <Button type="submit" className="w-full">
            Continue to Verification
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Button
            variant="ghost"
            onClick={() => setStep("contact")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Change contact method
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-stone-100 flex items-center justify-center p-4">
      {step === "contact" && renderContactStep()}
      {step === "details" && renderDetailsStep()}
    </div>
  )
}
