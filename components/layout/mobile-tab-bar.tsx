"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo } from "react"

import { PRIMARY_NAV_ITEMS } from "@/components/layout/nav-config"
import { AUTH_HIDDEN_ROUTES } from "@/components/layout/navigation-visibility"
import { cn } from "@/lib/utils"

const MOBILE_NAV_ITEMS = PRIMARY_NAV_ITEMS.slice(0, 5)

export function MobileTabBar() {
  const pathname = usePathname() ?? "/"

  const shouldHide = useMemo(
    () => AUTH_HIDDEN_ROUTES.some((pattern) => pattern.test(pathname)),
    [pathname],
  )

  if (shouldHide) {
    return null
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[var(--z-header)] border-t border-white/10 bg-white/80 backdrop-blur-xl dark:border-white/5 dark:bg-slate-950/80 md:hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.35rem)" }}
    >
      <nav className="flex items-center justify-around px-2 py-2">
        {MOBILE_NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-semibold",
                isActive
                  ? "bg-gradient-to-r from-violet-500 to-cyan-400 text-white shadow-lg"
                  : "text-muted-foreground",
              )}
            >
              <item.icon
                className={cn("h-5 w-5", isActive ? "text-white" : "text-muted-foreground")}
                aria-hidden
              />
              <span>{item.name}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
