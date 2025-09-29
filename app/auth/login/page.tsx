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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ContactMethodSelector } from "@/components/auth/contact-method-selector"
import { Loader2, LogIn, Shield } from "lucide-react"

type LoginMethod = "password" | "otp"

export default function LoginPage() {
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("password")
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok) {
        router.push("/dashboard")
      } else {
        setError(data.error || "Login failed")
      }
    } catch (err) {
      setError("Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleOTPLogin = async (data: { email?: string; phone?: string; method: "email" | "phone" }) => {
    setIsLoading(true)
    setError("")

    try {
      // First check if user exists
      const checkResponse = await fetch("/api/auth/check-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          phone: data.phone,
        }),
      })

      const checkData = await checkResponse.json()

      if (!checkResponse.ok) {
        setError(checkData.error || "User not found")
        return
      }

      // Send OTP for login
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          phone: data.phone,
          purpose: "login",
        }),
      })

      const result = await response.json()

      if (response.ok) {
        // Redirect to OTP verification
        const params = new URLSearchParams({
          purpose: "login",
        })

        if (data.email) params.set("email", data.email)
        if (data.phone) params.set("phone", data.phone)

        router.push(`/auth/verify-otp?${params.toString()}`)
      } else {
        setError(result.error || "Failed to send verification code")
      }
    } catch (err) {
      setError("Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-stone-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center">
            <LogIn className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
          <CardDescription>Sign in to your mining account</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Tabs value={loginMethod} onValueChange={(value) => setLoginMethod(value as LoginMethod)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="password" className="flex items-center gap-2">
                <LogIn className="w-4 h-4" />
                Password
              </TabsTrigger>
              <TabsTrigger value="otp" className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                OTP
              </TabsTrigger>
            </TabsList>

            <TabsContent value="password" className="space-y-4 mt-4">
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="otp" className="mt-4">
              <ContactMethodSelector onSubmit={handleOTPLogin} isLoading={isLoading} error={error} />
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Don't have an account? </span>
            <Link href="/auth/register" className="text-primary hover:underline font-medium">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
