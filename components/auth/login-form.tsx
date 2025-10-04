"use client"

import { type FormEvent, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, UserRoundPlus } from "lucide-react"

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SORTED_COUNTRY_DIAL_CODES } from "@/lib/constants/country-codes"

const PHONE_REGEX = /^\+[1-9]\d{7,14}$/

interface LoginFormData {
  email: string
  countryCode: string
  phone: string
  password: string
}

export function LoginForm() {
  const router = useRouter()
  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    countryCode: "+1",
    phone: "",
    password: "",
  })
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      let identifier = formData.email.trim().toLowerCase()
      let identifierType: "email" | "phone" = "email"

      if (authMethod === "phone") {
        const cleanedPhone = formData.phone.replace(/\D/g, "")
        const normalizedPhone = `${formData.countryCode}${cleanedPhone}`

        if (!PHONE_REGEX.test(normalizedPhone)) {
          setError("Please enter a valid international phone number")
          setIsLoading(false)
          return
        }

        identifier = normalizedPhone
        identifierType = "phone"
      } else if (!identifier) {
        setError("Email is required")
        setIsLoading(false)
        return
      }

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier,
          identifierType,
          password: formData.password,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError((data as { error?: string }).error || "Login failed")
        return
      }

      router.push("/dashboard")
    } catch (submitError) {
      console.error("Login error", submitError)
      setError("Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full overflow-hidden rounded-[2.5rem] border border-white/10 bg-black/60 shadow-[0_25px_60px_rgba(14,116,144,0.35)]">
      <div className="relative overflow-hidden px-10 py-10 text-center text-emerald-950">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/80 via-lime-400/60 to-amber-300/60" />
        <div className="relative space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-emerald-950/80">Welcome Back</p>
          <h1 className="text-2xl font-bold uppercase tracking-[0.2em]">Apple Mine Gateway</h1>
          <p className="text-sm font-medium text-emerald-950/80">Sign in to reignite your orchard-grade mining pods</p>
        </div>
      </div>

      <div className="space-y-6 px-8 py-8 sm:px-10">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-400/15 text-emerald-200 shadow-[0_15px_30px_rgba(34,197,94,0.25)]">
            <UserRoundPlus className="h-8 w-8" />
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <Tabs
            value={authMethod}
            onValueChange={(value) => {
              setAuthMethod(value as "email" | "phone")
              setError("")
            }}
            className="space-y-4"
          >
            <TabsList className="grid w-full grid-cols-2 rounded-full bg-emerald-500/10 p-1">
              <TabsTrigger
                value="email"
                className="rounded-full text-sm font-semibold data-[state=active]:bg-emerald-400 data-[state=active]:text-emerald-950"
              >
                Email
              </TabsTrigger>
              <TabsTrigger
                value="phone"
                className="rounded-full text-sm font-semibold data-[state=active]:bg-emerald-400 data-[state=active]:text-emerald-950"
              >
                Phone
              </TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-emerald-100/90">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="enter@email.com"
                value={formData.email}
                onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                className="h-12 rounded-xl border-emerald-400/30 bg-black/40"
              />
            </TabsContent>

            <TabsContent value="phone" className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-semibold text-emerald-100/90">
                Phone Number
              </Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select
                  value={formData.countryCode}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, countryCode: value }))}
                >
                  <SelectTrigger className="h-12 rounded-xl border-emerald-400/30 bg-black/40 sm:w-40">
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
                  className="h-12 flex-1 rounded-xl border-emerald-400/30 bg-black/40"
                />
              </div>
              <p className="text-xs text-emerald-100/70">
                Use the number you registered with, including the country code.
              </p>
            </TabsContent>
          </Tabs>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-semibold text-emerald-100/90">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))}
              required
              className="h-12 rounded-xl border-emerald-400/30 bg-black/40"
            />
          </div>

          <div className="flex items-center justify-end text-sm">
            <Link
              href="/auth/forgot"
              className="font-medium text-emerald-300 underline-offset-4 transition-colors hover:text-emerald-200 hover:underline"
            >
              Forgot Password?
            </Link>
          </div>

          <Button
            type="submit"
            className="h-12 w-full rounded-xl bg-gradient-to-r from-emerald-400 via-lime-400 to-amber-300 text-base font-semibold text-emerald-950 shadow-[0_20px_40px_rgba(34,197,94,0.25)] hover:from-emerald-300 hover:via-lime-300 hover:to-amber-200"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing In...
              </>
            ) : (
              "Enter Dashboard"
            )}
          </Button>
        </form>

        <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-5 text-center text-sm text-emerald-100/80">
          New to Apple Mine?{" "}
          <Link href="/auth/register" className="font-semibold text-emerald-200 underline-offset-4 hover:underline">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  )
}
