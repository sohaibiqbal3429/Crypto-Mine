"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { Loader2, Sparkles } from "lucide-react"

import { NotificationBell } from "@/components/notifications/notification-bell"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { PRIMARY_NAV_ITEMS } from "./nav-config"
import { AUTH_HIDDEN_ROUTES } from "./navigation-visibility"

export function AppHeader() {
  const pathname = usePathname() ?? "/"

  const shouldHide = useMemo(
    () => AUTH_HIDDEN_ROUTES.some((pattern) => pattern.test(pathname)),
    [pathname],
  )

  if (shouldHide) {
    return null
  }

  return (
    <header className="sticky top-0 z-[var(--z-header)] border-b border-white/20 bg-gradient-to-r from-white/80 via-white/60 to-white/30 backdrop-blur-2xl dark:from-slate-950/80 dark:via-slate-900/70 dark:to-slate-900/40">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-3" prefetch>
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-400 shadow-lg shadow-indigo-500/30">
              <Image src="/logo.png" alt="CryptoMine" width={40} height={40} className="h-10 w-10 rounded-xl object-contain" priority />
            </div>
            <div>
              <p className="text-base font-semibold tracking-wide text-foreground">Mintmine Aurora</p>
              <p className="text-xs font-medium uppercase text-muted-foreground">Premium cloud mining</p>
            </div>
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
            {PRIMARY_NAV_ITEMS.slice(0, 7).map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition",
                    isActive
                      ? "bg-gradient-to-r from-purple-500 to-cyan-400 text-white shadow-lg"
                      : "text-muted-foreground hover:bg-white/70 hover:text-foreground dark:hover:bg-white/5",
                  )}
                >
                  <item.icon className={cn("h-4 w-4", isActive ? "text-white" : "text-muted-foreground group-hover:text-foreground dark:group-hover:text-white/90")} aria-hidden />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <NotificationBell />
            <ProfileShortcut />
            <LogoutButton />
          </div>
        </div>

        <nav className="-mx-2 flex gap-2 overflow-x-auto pb-1 lg:hidden">
          {PRIMARY_NAV_ITEMS.slice(0, 6).map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold",
                  isActive
                    ? "bg-gradient-to-r from-indigo-500 to-cyan-400 text-white"
                    : "bg-white/50 text-muted-foreground dark:bg-white/5",
                )}
              >
                <item.icon className="h-4 w-4" aria-hidden />
                {item.name}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}

function ProfileShortcut() {
  return (
    <Link
      href="/profile"
      className="flex items-center gap-2 rounded-full border border-white/40 bg-white/80 px-3 py-1.5 text-sm font-semibold text-foreground shadow-lg shadow-purple-500/10 dark:border-white/10 dark:bg-white/5"
    >
      <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-indigo-500 to-cyan-400 text-xs font-bold text-white">
        <Sparkles className="h-4 w-4" aria-hidden />
      </div>
      <span className="hidden sm:inline">My Space</span>
    </Link>
  )
}

function LogoutButton() {
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
      size="icon"
      variant="ghost"
      aria-label="Sign out"
      disabled={isLoggingOut}
      onClick={() => {
        void handleLogout()
      }}
      className="rounded-full border border-white/30 bg-white/10 text-foreground hover:bg-white/30 dark:text-white"
    >
      {isLoggingOut ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <span className="text-sm font-semibold">Exit</span>}
    </Button>
  )
}
