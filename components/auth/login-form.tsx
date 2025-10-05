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
        credentials: "include",
        body: JSON.stringify({
          identifier,
          identifierType,
          password: formData.password,
        }),
      })

      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean
        error?: string
      }

      if (!response.ok || !data?.success) {
        setError(data?.error || "Login failed")
        return
      }

      router.replace("/dashboard")
      router.refresh()
    } catch (submitError) {
      console.error("Login error", submitError)
      setError("Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-border/70 bg-card shadow-xl shadow-primary/10 transition-colors">
      <div className="bg-gradient-to-r from-primary to-accent py-4 text-center text-primary-foreground">
        <h1 className="text-lg font-semibold tracking-wide">User Referral Login System</h1>
      </div>

      <div className="space-y-6 px-6 py-6 sm:px-8">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border/60 bg-background/80 text-primary shadow-sm">
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
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="phone">Phone</TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-foreground/90">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                className="h-11"
              />
            </TabsContent>

            <TabsContent value="phone" className="space-y-2">
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
                  className="h-11 flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Use the number you registered with, including the country code.
              </p>
            </TabsContent>
          </Tabs>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-semibold text-foreground/90">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))}
              required
              className="h-11"
            />
          </div>

          <div className="flex items-center justify-end text-sm">
            <Link
              href="/auth/forgot"
              className="font-medium text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline"
            >
              Forgot Password?
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button type="button" variant="outline" className="flex-1 h-11" onClick={() => router.push("/auth/register")}>
              (Create Account)
            </Button>
            <Button type="submit" className="flex-1 h-11 shadow-lg shadow-primary/20" disabled={isLoading}>
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
  )
}
