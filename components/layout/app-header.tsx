"use client"

import { useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, HelpCircle, Menu } from "lucide-react"

import QuickActions, { AUTH_HIDDEN_ROUTES } from "@/components/layout/quick-actions"
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer"
import { getPageTitle, PRIMARY_NAV_ITEMS } from "@/components/layout/nav-config"
import { cn } from "@/lib/utils"

export function AppHeader() {
  const pathname = usePathname() ?? "/"
  const [drawerOpen, setDrawerOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  const shouldHide = useMemo(
    () => AUTH_HIDDEN_ROUTES.some((pattern) => pattern.test(pathname)),
    [pathname],
  )

  const pageTitle = useMemo(() => getPageTitle(pathname), [pathname])

  if (shouldHide) {
    return null
  }

  return (
    <>
      <header
        className="sticky top-0 z-[100] border-b border-border/60 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex min-h-[64px] max-w-6xl items-center gap-4 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              ref={menuButtonRef}
              type="button"
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-secondary/70 text-foreground transition lg:hidden",
                "hover:border-primary/80 hover:text-primary",
              )}
              aria-label="Open menu"
              aria-expanded={drawerOpen}
              aria-controls="mobile-drawer"
              onClick={() => setDrawerOpen(true)}
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>

            <Link href="/dashboard" className="group flex items-center gap-2" prefetch>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-md shadow-primary/30">
                <Image src="/logo.png" alt="5gbotify" width={20} height={20} className="h-5 w-5" priority />
              </span>
              <div className="leading-tight">
                <span className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">5gbotify</span>
                <div className="text-base font-bold text-foreground">Network Control</div>
              </div>
            </Link>
          </div>

          <nav className="hidden flex-1 items-center gap-1 rounded-lg border border-border/70 bg-secondary/60 px-2 py-1 text-sm font-medium lg:flex">
            {PRIMARY_NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 transition",
                    "hover:bg-background/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                    isActive
                      ? "bg-background/80 text-primary shadow-sm shadow-primary/20"
                      : "text-muted-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" aria-hidden />
                  <span className="whitespace-nowrap">{item.name}</span>
                </Link>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-lg border border-border/70 bg-secondary/60 px-2 py-1 lg:flex">
              <Link
                href="/transactions"
                className="group flex size-10 items-center justify-center rounded-md text-muted-foreground transition hover:bg-background/70 hover:text-primary"
                aria-label="Activity timeline"
              >
                <Activity className="h-5 w-5" aria-hidden />
              </Link>
              <Link
                href="/support"
                className="group flex size-10 items-center justify-center rounded-md text-muted-foreground transition hover:bg-background/70 hover:text-primary"
                aria-label="Help desk"
              >
                <HelpCircle className="h-5 w-5" aria-hidden />
              </Link>
              <Link
                href="/profile"
                className="group flex size-10 items-center justify-center rounded-md border border-border/50 bg-background/40 text-muted-foreground transition hover:border-primary/60 hover:text-primary"
                aria-label="Account center"
              >
                <span className="text-xs font-semibold">AC</span>
              </Link>
            </div>
            <QuickActions variant="mobile" mobileClassName="lg:hidden" inline />
            <QuickActions variant="desktop" inline />
          </div>
        </div>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 pb-3 text-xs text-muted-foreground lg:px-6">
          <div className="flex items-center gap-2 text-muted-foreground/80">
            <span className="rounded-sm bg-primary/10 px-2 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-primary">{pageTitle}</span>
            <span className="hidden sm:inline">Real-time network telemetry synced</span>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_12px_rgba(125,255,106,0.65)]" />
            <span className="text-muted-foreground/70">Cluster link stable</span>
          </div>
        </div>
      </header>

      <MobileNavDrawer open={drawerOpen} onOpenChange={setDrawerOpen} anchorRef={menuButtonRef} />
    </>
  )
}
