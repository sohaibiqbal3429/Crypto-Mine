"use client"

import { useEffect, useMemo, useState } from "react"

import { MoonStar, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ThemeToggle() {
  const { resolvedTheme, setTheme, theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const activeTheme = useMemo(() => resolvedTheme ?? theme ?? "system", [resolvedTheme, theme])

  const handleToggle = () => {
    const nextTheme = activeTheme === "dark" ? "light" : "dark"
    setTheme(nextTheme)
  }

  if (!mounted) {
    return null
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={handleToggle}
      className={cn(
        "relative flex h-11 w-11 items-center justify-center rounded-full border border-border/70 bg-background/70 shadow-sm transition-all duration-[var(--t-fast,180ms)] ease-[var(--ease)]",
        "hover:-translate-y-[2px] hover:shadow-[0_12px_24px_rgba(15,23,42,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
      )}
    >
      <Sun
        className={cn(
          "h-5 w-5 transition-transform duration-[var(--t-med,240ms)] ease-[var(--ease)]",
          activeTheme === "dark" ? "-rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100",
        )}
      />
      <MoonStar
        className={cn(
          "absolute h-5 w-5 transition-transform duration-[var(--t-med,240ms)] ease-[var(--ease)]",
          activeTheme === "dark" ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-0 opacity-0",
        )}
      />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
