"use client"

import { useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Loader2, LogOut } from "lucide-react"

import { NotificationBell } from "@/components/notifications/notification-bell"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
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
      <span className="hidden h-5 w-px bg-border/60 md:block" aria-hidden />
      <LogoutAction />
    </div>
  )

  return (
    <>
      {showMobile ? (
        <div
          className={cn(
            "md:hidden flex items-center rounded-2xl border border-black/10 bg-white/80 px-2 py-1 text-sm text-black shadow-sm shadow-black/10 backdrop-blur-md transition-colors dark:border-white/10 dark:bg-black/40 dark:text-white",
            mobileClassName,
          )}
        >
          {renderActions()}
        </div>
      ) : null}

      {showDesktop ? (
        <div className="pointer-events-none hidden md:fixed md:right-4 md:top-4 md:z-[var(--z-header)] md:flex md:w-full md:justify-end md:px-2 lg:right-6 lg:top-6">
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-black shadow-lg shadow-black/10 backdrop-blur-md transition-colors dark:border-white/10 dark:bg-black/40 dark:text-white">
            {renderActions()}
          </div>
        </div>
      ) : null}
    </>
  )
}

function LogoutAction() {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error("Failed to sign out")
      }

      router.push("/auth/login")
      router.refresh()
    } catch (error) {
      console.error("Logout error", error)
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="rounded-full text-black hover:bg-black/5 dark:text-white dark:hover:bg-white/10"
      onClick={() => {
        void handleLogout()
      }}
      disabled={isLoggingOut}
      aria-label="Sign out"
    >
      {isLoggingOut ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <LogOut className="h-5 w-5" aria-hidden />}
    </Button>
  )
}
