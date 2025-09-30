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
    <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-xl border border-slate-200 bg-white">
      <div className="bg-black text-white text-center py-4">
        <h1 className="text-lg font-semibold tracking-wide">User Referral Login System</h1>
      </div>

      <div className="px-6 sm:px-8 py-6 space-y-6">
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
              <Label htmlFor="email" className="text-sm font-semibold text-slate-700">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                className="h-11 rounded-md border-slate-300 bg-slate-50 text-slate-700 placeholder:text-slate-400"
              />
            </TabsContent>

            <TabsContent value="phone" className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-semibold text-slate-700">
                Phone Number
              </Label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <Select
                  value={formData.countryCode}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, countryCode: value }))}
                >
                  <SelectTrigger className="sm:w-40 h-11 rounded-md border-slate-300 bg-slate-50 text-slate-700">
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
                  className="h-11 flex-1 rounded-md border-slate-300 bg-slate-50 text-slate-700 placeholder:text-slate-400"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Use the number you registered with, including the country code.
              </p>
            </TabsContent>
          </Tabs>

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
  )
}
