"use client"

import { useMemo } from "react"
import { usePathname } from "next/navigation"

import { NotificationBell } from "@/components/notifications/notification-bell"
import { ThemeToggle } from "@/components/theme-toggle"

const AUTH_HIDDEN_ROUTES = [
  /^\/login(?:\/.*)?$/,
  /^\/signin(?:\/.*)?$/,
  /^\/signup(?:\/.*)?$/,
  /^\/forgot-password(?:\/.*)?$/,
  /^\/auth\/(?:login|register|forgot|verify-otp)(?:\/.*)?$/,
]

export default function QuickActions() {
  const pathname = usePathname() ?? "/"

  const shouldHide = useMemo(
    () => AUTH_HIDDEN_ROUTES.some((pattern) => pattern.test(pathname)),
    [pathname],
  )

  if (shouldHide) {
    return null
  }

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[var(--z-header)] flex w-full justify-end px-2 sm:right-6 sm:top-6">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-border/70 bg-card/80 px-3 py-2 shadow-lg shadow-black/5 backdrop-blur">
        <NotificationBell />
        <span className="h-5 w-px bg-border/60" aria-hidden />
        <ThemeToggle />
      </div>
    </div>
  )
}
