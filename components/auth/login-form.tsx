"use client"

import { type FormEvent, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { KeyRound, Loader2, Mail, Phone } from "lucide-react"

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
    <div className="relative overflow-hidden rounded-[2.75rem] border border-white/15 bg-black/50 shadow-[0_30px_90px_rgba(59,130,246,0.28)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(125,211,252,0.25),_transparent_60%)]" />
      <div className="absolute inset-x-6 top-6 h-40 rounded-[2.25rem] bg-gradient-to-r from-cyan-400/30 via-sky-400/20 to-fuchsia-400/30 blur-3xl" />
      <div className="relative space-y-8 px-8 pb-10 pt-12 sm:px-10">
        <div className="space-y-2 text-center text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.45em] text-cyan-100/70">Login Portal</p>
          <h1 className="text-3xl font-bold">Apple Mine Access Console</h1>
          <p className="text-sm text-white/70">
            Authenticate with your preferred channel and rejoin your luminous mining habitat.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 text-white">
          <Tabs
            value={authMethod}
            onValueChange={(value) => {
              setAuthMethod(value as "email" | "phone")
              setError("")
            }}
            className="space-y-4"
          >
            <TabsList className="grid w-full grid-cols-2 rounded-full border border-white/15 bg-white/10 p-1">
              <TabsTrigger
                value="email"
                className="rounded-full text-sm font-semibold text-white/70 data-[state=active]:bg-white data-[state=active]:text-slate-900"
              >
                <Mail className="mr-2 h-4 w-4" /> Email
              </TabsTrigger>
              <TabsTrigger
                value="phone"
                className="rounded-full text-sm font-semibold text-white/70 data-[state=active]:bg-white data-[state=active]:text-slate-900"
              >
                <Phone className="mr-2 h-4 w-4" /> Phone
              </TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="space-y-3">
              <Label htmlFor="email" className="text-sm font-semibold text-white/80">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="name@domain.com"
                value={formData.email}
                onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                className="h-12 rounded-2xl border-white/20 bg-white/10 text-white placeholder:text-white/40"
              />
            </TabsContent>

            <TabsContent value="phone" className="space-y-3">
              <Label htmlFor="phone" className="text-sm font-semibold text-white/80">
                Phone Number
              </Label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Select
                  value={formData.countryCode}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, countryCode: value }))}
                >
                  <SelectTrigger className="h-12 rounded-2xl border-white/20 bg-white/10 text-white sm:w-44">
                    <SelectValue placeholder="Code" />
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
                  className="h-12 flex-1 rounded-2xl border-white/20 bg-white/10 text-white placeholder:text-white/40"
                />
              </div>
              <p className="text-xs text-white/60">Use the number linked to your Apple Mine ident, including the country code.</p>
            </TabsContent>
          </Tabs>

          <div className="space-y-3">
            <Label htmlFor="password" className="text-sm font-semibold text-white/80">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your passphrase"
              value={formData.password}
              onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))}
              className="h-12 rounded-2xl border-white/20 bg-white/10 text-white placeholder:text-white/40"
            />
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/auth/forgot-password" className="text-sm font-medium text-cyan-100/80 hover:text-cyan-100">
              Forgot your passphrase?
            </Link>
            <Button
              type="submit"
              className="h-12 w-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-fuchsia-500 text-base font-semibold text-slate-900 shadow-lg shadow-cyan-500/30 hover:from-cyan-300 hover:via-sky-300 hover:to-fuchsia-400 sm:w-auto"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  <KeyRound className="mr-2 h-4 w-4" /> Enter Habitat
                </>
              )}
            </Button>
          </div>
        </form>

        <div className="flex flex-col items-center justify-between gap-3 rounded-[1.75rem] border border-white/10 bg-white/5 px-6 py-5 text-center text-xs text-white/70 sm:flex-row sm:text-left">
          <span>First time exploring Apple Mine?</span>
          <Link href="/auth/register" className="font-semibold text-white hover:text-cyan-100">
            Initiate your ident
          </Link>
        </div>
      </div>
    </div>
  )
}
