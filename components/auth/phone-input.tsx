"use client"

import { useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { validatePhoneNumber } from "@/lib/utils/otp"
import { SORTED_COUNTRY_DIAL_CODES } from "@/lib/constants/country-codes"

interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
  error?: string
}

export default function PhoneInput({ value, onChange, error }: PhoneInputProps) {
  const initialCode = useMemo(() => {
    const match = value.match(/^(\+\d{1,4})/)
    return match ? match[1] : "+1"
  }, [value])
  const [selectedCountry, setSelectedCountry] = useState(initialCode)
  const [phoneNumber, setPhoneNumber] = useState(() => value.replace(/^(\+\d{1,4})/, ""))

  useEffect(() => {
    const match = value.match(/^(\+\d{1,4})(\d*)/)
    if (match) {
      setSelectedCountry(match[1])
      setPhoneNumber(match[2])
    }
  }, [value])

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
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <Select value={selectedCountry} onValueChange={handleCountryChange}>
          <SelectTrigger className="sm:w-44">
            <SelectValue />
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
