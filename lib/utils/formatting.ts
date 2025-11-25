// Currency formatting utilities
export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatCrypto(amount: number, symbol = "PCN", decimals = 4): string {
  return `${amount.toFixed(decimals)} ${symbol}`
}

// Number formatting utilities
export function formatNumber(num: number, decimals = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num)
}

export function formatLargeNumber(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`
  return num.toString()
}

// Date formatting utilities
export function formatDate(date: Date | string, format: "short" | "long" | "relative" = "short"): string {
  const d = typeof date === "string" ? new Date(date) : date

  if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
    return "Date unavailable"
  }

  if (format === "relative") {
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`
    if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
    return "Just now"
  }

  if (format === "long") {
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
    return "Time unavailable"
  }
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Phone number formatting
export function formatPhoneDisplay(phone: string): string {
  const cleaned = phone.replace(/[^\d]/g, "")
  if (!cleaned) return phone

  // Basic grouping every 3-4 digits for readability
  const groups: string[] = []
  let index = 0
  const countryCodeLength = Math.min(3, Math.max(1, cleaned.length - 6))
  const countryCode = cleaned.slice(0, countryCodeLength)
  let remaining = cleaned.slice(countryCodeLength)

  while (remaining.length > 0) {
    const chunkSize = remaining.length > 4 ? 3 : remaining.length
    groups.push(remaining.slice(0, chunkSize))
    remaining = remaining.slice(chunkSize)
    index += 1
  }

  return `+${countryCode}${groups.length ? " " : ""}${groups.join(" ")}`
}

// Percentage formatting
export function formatPercentage(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`
}

// Hash/Address formatting (for crypto addresses)
export function formatHash(hash: string, startChars = 6, endChars = 4): string {
  if (hash.length <= startChars + endChars) return hash
  return `${hash.slice(0, startChars)}...${hash.slice(-endChars)}`
}

// File size formatting
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

// Duration formatting
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}
