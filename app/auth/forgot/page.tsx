"use client"

import { type FormEvent, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, LockKeyhole } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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

  useEffect(() => {
    return () => {
      if (redirectTimeout.current) {
        clearTimeout(redirectTimeout.current)
      }
    }
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setSuccess("")

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Unable to reset password")
        return
      }

      setSuccess("Password updated successfully. Redirecting to login...")
      redirectTimeout.current = setTimeout(() => {
        router.push("/auth/login")
      }, 1500)
      setFormData({ email: "", password: "", confirmPassword: "" })
    } catch (error) {
      console.error("Forgot password error", error)
      setError("Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-xl border border-slate-200 bg-white">
        <div className="bg-black text-white text-center py-4">
          <h1 className="text-lg font-semibold tracking-wide">Reset Your Password</h1>
        </div>

        <div className="px-8 py-6 space-y-6">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-full border border-slate-300 flex items-center justify-center text-slate-600">
              <LockKeyhole className="w-8 h-8" />
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
              <Label htmlFor="email" className="text-sm font-semibold text-slate-700">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your registered email"
                value={formData.email}
                onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                required
                className="h-11 rounded-md border-slate-300 bg-slate-50 text-slate-700 placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold text-slate-700">
                New Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter new password"
                value={formData.password}
                onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))}
                required
                minLength={6}
                className="h-11 rounded-md border-slate-300 bg-slate-50 text-slate-700 placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-semibold text-slate-700">
                Confirm Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter new password"
                value={formData.confirmPassword}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, confirmPassword: event.target.value }))
                }
                required
                minLength={6}
                className="h-11 rounded-md border-slate-300 bg-slate-50 text-slate-700 placeholder:text-slate-400"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                className="sm:w-auto h-11 border-black text-black hover:bg-black/10"
                onClick={() => router.push("/auth/login")}
              >
                Back to Login
              </Button>

              <Button type="submit" className="h-11 flex-1 sm:flex-none bg-black hover:bg-black/90" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </div>
          </form>

          <p className="text-center text-sm text-slate-600">
            Remembered your password?{" "}
            <Link href="/auth/login" className="font-semibold text-black hover:underline">
              Login here
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
