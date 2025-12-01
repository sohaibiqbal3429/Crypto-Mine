"use client"

import { useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"

import QuickActions, { AUTH_HIDDEN_ROUTES } from "@/components/layout/quick-actions"
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer"
import { getPageTitle } from "@/components/layout/nav-config"
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
        className="sticky top-0 z-[100] border-b border-black/5 bg-white/80 backdrop-blur-md shadow-sm shadow-black/5 transition-colors dark:border-white/10 dark:bg-black/40 md:hidden"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex min-h-[56px] items-center gap-3 px-3 pb-2 pt-2">
          <button
            ref={menuButtonRef}
            type="button"
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-2xl border border-black/10 bg-white text-black transition dark:border-white/10 dark:bg-[#1e1e1e] dark:text-white",
              "hover:bg-black/5 active:scale-95 dark:hover:bg-white/10",
            )}
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            aria-controls="mobile-drawer"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Link href="/" className="flex items-center gap-2" prefetch>
              <Image src="/logo.png" alt="CryptoMine" width={32} height={32} className="h-8 w-8 rounded-lg" priority />
              <span className="text-base font-semibold text-black dark:text-white">CryptoMine</span>
            </Link>
            <span className="truncate text-sm font-medium text-black/80 dark:text-white/80">{pageTitle}</span>
          </div>

          <QuickActions variant="mobile" mobileClassName="ml-auto" />
        </div>
      </header>

      <QuickActions variant="desktop" />

      <MobileNavDrawer open={drawerOpen} onOpenChange={setDrawerOpen} anchorRef={menuButtonRef} />
    </>
  )
}
