"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"

import QuickActions, { AUTH_HIDDEN_ROUTES } from "@/components/layout/quick-actions"
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer"
import { PRIMARY_NAV_ITEMS } from "@/components/layout/nav-config"
import { cn } from "@/lib/utils"

export function AppHeader() {
  const pathname = usePathname() ?? "/"
  const [drawerOpen, setDrawerOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  const shouldHide = useMemo(
    () => AUTH_HIDDEN_ROUTES.some((pattern) => pattern.test(pathname)),
    [pathname],
  )

  if (shouldHide) {
    return null
  }

  return (
    <>
      <header
        className="sticky top-0 z-[100] border-b border-slate-800/80 bg-slate-950/80 shadow-[0_10px_40px_-24px_rgba(0,0,0,0.85)] backdrop-blur"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-3 md:px-6">
          <button
            ref={menuButtonRef}
            type="button"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-800/70 bg-slate-900 text-slate-100 transition hover:border-cyan-400/60 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 md:hidden"
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            aria-controls="mobile-drawer"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>

          <Link href="/" className="group flex items-center gap-3" prefetch>
            <div className="relative flex size-11 items-center justify-center rounded-xl border border-slate-800/70 bg-gradient-to-br from-emerald-400/20 via-cyan-400/10 to-blue-500/10 text-cyan-200 shadow-lg shadow-emerald-500/15 transition group-hover:border-cyan-300/70 group-hover:text-white">
              <span className="text-lg font-black drop-shadow">5G</span>
              <span className="absolute -bottom-1 left-1 h-1 w-6 rounded-full bg-emerald-400/70" />
            </div>
            <div className="leading-tight">
              <span className="text-[11px] uppercase tracking-[0.28em] text-emerald-200/80">Signal grid</span>
              <div className="flex items-center gap-2 text-lg font-semibold text-slate-50">
                5gbotify
                <span className="flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase text-emerald-200">live</span>
              </div>
            </div>
          </Link>

          <nav className="hidden flex-1 items-center gap-1 md:flex">
            {PRIMARY_NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
                    isActive
                      ? "bg-gradient-to-r from-cyan-500/20 to-emerald-400/20 text-white shadow-inner shadow-cyan-500/10"
                      : "text-slate-300 hover:-translate-y-[1px] hover:bg-slate-800/60 hover:text-white",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <item.icon className="h-4 w-4" aria-hidden />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <QuickActions variant="mobile" mobileClassName="md:hidden" />
            <QuickActions variant="desktop" />
          </div>
        </div>
      </header>

      <MobileNavDrawer open={drawerOpen} onOpenChange={setDrawerOpen} anchorRef={menuButtonRef} />
    </>
  )
}
