"use client"

import { type FormEvent, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function RegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    referralCode: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          referralCode: formData.referralCode,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Registration failed")
        return
      }

      router.push("/dashboard")
    } catch (error) {
      console.error("Registration error", error)
      setError("Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-2xl overflow-hidden shadow-xl border border-slate-200 bg-white">
        <div className="bg-black text-white text-center py-4">
          <h1 className="text-lg font-semibold tracking-wide">Referral Signup System</h1>
        </div>

        <div className="px-8 py-6 space-y-6">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-full border border-slate-300 flex items-center justify-center text-slate-600">
              <UserPlus className="w-8 h-8" />
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-semibold text-slate-700">
                  Name
                </Label>
                <Input
                  id="name"
                  placeholder="Enter name"
                  value={formData.name}
                  onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                  required
                  className="h-11 rounded-md border-slate-300 bg-slate-50 text-slate-700 placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold text-slate-700">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter email"
                  value={formData.email}
                  onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                  required
                  className="h-11 rounded-md border-slate-300 bg-slate-50 text-slate-700 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold text-slate-700">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={formData.password}
                  onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))}
                  required
                  minLength={6}
                  className="h-11 rounded-md border-slate-300 bg-slate-50 text-slate-700 placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-semibold text-slate-700">
                  Re-enter Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter password"
                  value={formData.confirmPassword}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, confirmPassword: event.target.value }))
                  }
                  required
                  minLength={6}
                  className="h-11 rounded-md border-slate-300 bg-slate-50 text-slate-700 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="referralCode" className="text-sm font-semibold text-slate-700">
                Referral Code
              </Label>
              <Input
                id="referralCode"
                placeholder="Referral code"
                value={formData.referralCode}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, referralCode: event.target.value.toUpperCase() }))
                }
                required
                className="h-11 rounded-md border-slate-300 bg-slate-50 text-slate-700 placeholder:text-slate-400"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                className="sm:w-auto h-11 border-black text-black hover:bg-black/10"
                onClick={() => router.push("/auth/forgot")}
              >
                Forgot Password?
              </Button>

              <Button type="submit" className="h-11 flex-1 sm:flex-none bg-black hover:bg-black/90" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registering...
                  </>
                ) : (
                  "Register"
                )}
              </Button>
            </div>
          </form>

          <p className="text-center text-sm text-slate-600">
            Already have an account?{" "}
            <Link href="/auth/login" className="font-semibold text-black hover:underline">
              Login instead
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
