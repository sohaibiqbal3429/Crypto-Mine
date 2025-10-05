"use client"

import { useEffect, useState } from "react"
import { MoonStar, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ThemeToggleProps = {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn("relative h-11 w-11", className)}
        aria-label="Toggle theme"
        disabled
      >
        <Sun className="h-5 w-5 opacity-0" />
      </Button>
    )
  }

  const isDark = resolvedTheme === "dark"

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn("relative h-11 w-11 overflow-hidden", className)}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <Sun className={cn("h-5 w-5 transition-all", isDark ? "-rotate-90 scale-0" : "rotate-0 scale-100")} />
      <MoonStar
        className={cn(
          "absolute h-5 w-5 transition-all",
          isDark ? "rotate-0 scale-100" : "rotate-90 scale-0",
        )}
      />
    </Button>
  )
}
