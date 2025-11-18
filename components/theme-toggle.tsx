"use client"

import { useMemo } from "react"
import { MoonStar, Sun } from "lucide-react"

import { useThemePreference } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

export function ThemeToggle() {
  const { theme, toggleTheme, mounted } = useThemePreference()
  const isDark = useMemo(() => (mounted ? theme === "dark" : false), [mounted, theme])

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      aria-pressed={isDark}
      onClick={toggleTheme}
      className={cn(
        "relative inline-flex h-11 w-20 items-center justify-between rounded-full border border-white/30 bg-gradient-to-r",
        "from-violet-500/80 via-purple-500/70 to-cyan-400/70 px-2 text-white shadow-[0_12px_30px_rgba(88,28,135,0.35)]",
        "transition-all duration-300 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
        "dark:from-slate-900/80 dark:via-indigo-900/80 dark:to-emerald-700/80 dark:border-white/10",
      )}
    >
      <Sun
        className={cn(
          "relative z-10 h-5 w-5 transition-all duration-300",
          isDark ? "translate-x-0 opacity-40" : "-translate-x-1 opacity-100 drop-shadow",
        )}
      />
      <MoonStar
        className={cn(
          "relative z-10 h-5 w-5 transition-all duration-300",
          isDark ? "translate-x-1 opacity-100 drop-shadow" : "opacity-40",
        )}
      />
      <span
        className={cn(
          "pointer-events-none absolute inset-1 rounded-full bg-white/80 transition-all duration-300 dark:bg-white/10",
          isDark ? "translate-x-8" : "translate-x-0",
        )}
      />
    </button>
  )
}
