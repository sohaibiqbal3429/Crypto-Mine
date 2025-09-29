"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Mail, Phone, Info } from "lucide-react"

interface ContactMethodSelectorProps {
  onSubmit: (data: { email?: string; phone?: string; method: "email" | "phone" }) => void
  isLoading?: boolean
  error?: string
}

export function ContactMethodSelector({ onSubmit, isLoading, error }: ContactMethodSelectorProps) {
  const [activeTab, setActiveTab] = useState<"email" | "phone">("email")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [developmentOTP, setDevelopmentOTP] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setDevelopmentOTP(null) // Clear previous OTP

    console.log("[v0] Form submitted with:", { activeTab, email, phone })

    const submitData = activeTab === "email" ? { email, method: "email" as const } : { phone, method: "phone" as const }

    try {
      await onSubmit(submitData)
    } catch (err: any) {
      console.error("[v0] Submit error:", err)
      // Check if response contains development OTP
      if (err.developmentOTP) {
        setDevelopmentOTP(err.developmentOTP)
      }
    }
  }

  return (
    <div className="space-y-4">
      {process.env.NODE_ENV === "development" && (
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-blue-800">
            Development Mode: OTP will be displayed here instead of being sent via email/SMS.
          </AlertDescription>
        </Alert>
      )}

      {developmentOTP && (
        <Alert className="border-green-200 bg-green-50">
          <AlertDescription className="text-green-800">
            <strong>Development OTP:</strong> {developmentOTP}
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "email" | "phone")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email
            </TabsTrigger>
            <TabsTrigger value="phone" className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Phone
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </TabsContent>

          <TabsContent value="phone" className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="Enter your phone number (+92xxxxxxxxxx)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Include country code (e.g., +92 for Pakistan, +91 for India)
            </p>
          </TabsContent>
        </Tabs>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Sending..." : "Send Verification Code"}
        </Button>
      </form>
    </div>
  )
}
