"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { validatePhoneNumber } from "@/lib/utils/otp"

interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
  error?: string
}

const countryCodes = [
  { code: "+92", country: "Pakistan", flag: "🇵🇰" },
  { code: "+86", country: "China", flag: "🇨🇳" },
  { code: "+91", country: "India", flag: "🇮🇳" },
]

export default function PhoneInput({ value, onChange, error }: PhoneInputProps) {
  const [selectedCountry, setSelectedCountry] = useState("+92")
  const [phoneNumber, setPhoneNumber] = useState("")

  const handleCountryChange = (countryCode: string) => {
    setSelectedCountry(countryCode)
    if (phoneNumber) {
      onChange(`${countryCode}${phoneNumber}`)
    }
  }

  const handlePhoneChange = (phone: string) => {
    // Remove any non-digits
    const cleaned = phone.replace(/\D/g, "")
    setPhoneNumber(cleaned)
    onChange(`${selectedCountry}${cleaned}`)
  }

  const validation = validatePhoneNumber(value)

  return (
    <div className="space-y-2">
      <Label htmlFor="phone">Phone Number</Label>
      <div className="flex gap-2">
        <Select value={selectedCountry} onValueChange={handleCountryChange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {countryCodes.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                <span className="flex items-center gap-2">
                  <span>{country.flag}</span>
                  <span>{country.code}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          id="phone"
          type="tel"
          placeholder="Enter phone number"
          value={phoneNumber}
          onChange={(e) => handlePhoneChange(e.target.value)}
          className={error || (!validation.isValid && value) ? "border-destructive" : ""}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!validation.isValid && value && <p className="text-sm text-destructive">Please enter a valid phone number</p>}
    </div>
  )
}
