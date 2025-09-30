"use client"

import { type FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, UserRoundPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function LoginPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Login failed")
        return
      }

      router.push("/dashboard")
    } catch (error) {
      console.error("Login error", error)
      setError("Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-xl border border-slate-200 bg-white">
        <div className="bg-black text-white text-center py-4">
          <h1 className="text-lg font-semibold tracking-wide">User Referral Login System</h1>
        </div>

        <div className="px-8 py-6 space-y-6">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-full border border-slate-300 flex items-center justify-center text-slate-600">
              <UserRoundPlus className="w-8 h-8" />
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-slate-700">
                Username or Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                required
                className="h-11 rounded-md border-slate-300 bg-slate-50 text-slate-700 placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold text-slate-700">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))}
                required
                className="h-11 rounded-md border-slate-300 bg-slate-50 text-slate-700 placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center justify-end text-sm">
              <Link href="/auth/forgot" className="text-slate-600 hover:text-black font-medium underline-offset-4 hover:underline">
                Forgot Password?
              </Link>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-11 border-black text-black hover:bg-black/10"
                onClick={() => router.push("/auth/register")}
              >
                (Create Account)
              </Button>
              <Button type="submit" className="flex-1 h-11 bg-black hover:bg-black/90" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  "Login"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
