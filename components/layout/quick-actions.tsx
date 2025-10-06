"use client"

import { useMemo } from "react"
import { usePathname } from "next/navigation"

import { NotificationBell } from "@/components/notifications/notification-bell"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

export const AUTH_HIDDEN_ROUTES = [
  /^\/login(?:\/.*)?$/,
  /^\/signin(?:\/.*)?$/,
  /^\/signup(?:\/.*)?$/,
  /^\/forgot-password(?:\/.*)?$/,
  /^\/auth\/(?:login|register|forgot|verify-otp)(?:\/.*)?$/,
]

type QuickActionsVariant = "mobile" | "desktop" | "both"

type QuickActionsProps = {
  mobileClassName?: string
  variant?: QuickActionsVariant
}

export default function QuickActions({ mobileClassName, variant = "both" }: QuickActionsProps = {}) {
  const pathname = usePathname() ?? "/"

  const shouldHide = useMemo(
    () => AUTH_HIDDEN_ROUTES.some((pattern) => pattern.test(pathname)),
    [pathname],
  )

  if (shouldHide) {
    return null
  }

  const showMobile = variant === "mobile" || variant === "both"
  const showDesktop = variant === "desktop" || variant === "both"

  const renderActions = () => (
    <div className="flex items-center gap-2 md:gap-3">
      <NotificationBell />
      <span className="hidden h-5 w-px bg-border/60 md:block" aria-hidden />
      <ThemeToggle />
    </div>
  )

  return (
    <>
      {showMobile ? (
        <div
          className={cn(
            "md:hidden flex items-center rounded-2xl border border-border/60 bg-card/80 px-2 py-1 text-sm shadow-sm shadow-black/5 backdrop-blur supports-[backdrop-filter]:bg-card/60",
            mobileClassName,
          )}
        >
          {renderActions()}
        </div>
      ) : null}

      {showDesktop ? (
        <div className="pointer-events-none hidden md:fixed md:right-4 md:top-4 md:z-[var(--z-header)] md:flex md:w-full md:justify-end md:px-2 lg:right-6 lg:top-6">
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-border/70 bg-card/80 px-3 py-2 shadow-lg shadow-black/5 backdrop-blur supports-[backdrop-filter]:bg-card/60">
            {renderActions()}
          </div>
        </div>
      ) : null}
    </>
  )
}
