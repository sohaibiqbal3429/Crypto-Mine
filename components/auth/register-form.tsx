"use client"

import { type FormEvent, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, UserPlus } from "lucide-react"

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

  // Prefill referral code from query param (?ref= or ?referral=), once on mount / when URL changes
  useEffect(() => {
    const fromRef = (searchParams.get("ref") || searchParams.get("referral") || "").trim()
    if (fromRef && !formData.referralCode) {
      setFormData((prev) => ({ ...prev, referralCode: fromRef.toUpperCase() }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]) // don't include formData in deps to avoid unnecessary resets

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      return
    }

    const cleanedPhone = formData.phone.replace(/\D/g, "")
    const normalizedPhone = `${formData.countryCode}${cleanedPhone}`

    if (!PHONE_REGEX.test(normalizedPhone)) {
      setError("Please enter a valid international phone number")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: normalizedPhone,
          password: formData.password,
          referralCode: formData.referralCode.trim().toUpperCase(),
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError((data as { error?: string }).error || "Registration failed")
        return
      }

      router.push("/dashboard")
    } catch (submitError) {
      console.error("Registration error", submitError)
      setError("Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-border/70 bg-card shadow-xl shadow-primary/10 transition-colors">
      <div className="bg-gradient-to-r from-primary to-accent py-4 text-center text-primary-foreground">
        <h1 className="text-lg font-semibold tracking-wide">Referral Signup System</h1>
      </div>

      <div className="space-y-6 px-6 py-6 sm:px-8">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border/60 bg-background/80 text-primary shadow-sm">
            <UserPlus className="h-8 w-8" />
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold text-foreground/90">
                Name
              </Label>
              <Input
                id="name"
                placeholder="Enter name"
                value={formData.name}
                onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                required
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-foreground/90">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter email"
                value={formData.email}
                onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                required
                className="h-11"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-semibold text-foreground/90">
              Phone Number
            </Label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <Select
                value={formData.countryCode}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, countryCode: value }))}
              >
                <SelectTrigger className="h-11 rounded-md sm:w-40">
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {SORTED_COUNTRY_DIAL_CODES.map((country) => (
                    <SelectItem key={country.isoCode} value={country.dialCode}>
                      {country.name} ({country.dialCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                id="phone"
                inputMode="tel"
                placeholder="123456789"
                value={formData.phone}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, phone: event.target.value.replace(/[^\d]/g, "") }))
                }
                required
                className="h-11 flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Include your full phone number. Country code is added automatically.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold text-foreground/90">
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
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-semibold text-foreground/90">
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
                className="h-11"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="referralCode" className="text-sm font-semibold text-foreground/90">
              Referral Code
            </Label>
            <Input
              id="referralCode"
              type="text"
              placeholder="Enter referral code (required)"
              value={formData.referralCode}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, referralCode: e.target.value.toUpperCase() }))
              }
              required
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="outline" className="h-11 sm:w-auto" onClick={() => router.push("/auth/forgot")}>
              Forgot Password?
            </Button>

            <Button type="submit" className="h-11 flex-1 sm:flex-none shadow-lg shadow-primary/20" disabled={isLoading}>
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

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/auth/login" className="font-semibold text-primary hover:underline">
            Login instead
          </Link>
        </p>
      </div>
    </div>
  )
}
