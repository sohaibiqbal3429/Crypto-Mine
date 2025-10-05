"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"
import { cn } from "@/lib/utils"

type NavItem = {
  href: string
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/coins", label: "Coins" },
  { href: "/rewards", label: "Rewards" },
  { href: "/support", label: "Support" },
]

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
]
  .map((selector) => `${selector}:not([aria-hidden='true'])`)
  .join(",")

export function SiteHeader() {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const wasMenuOpenRef = useRef(false)
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const reducedMotion = usePrefersReducedMotion()

  const handleCloseMenu = useCallback(() => {
    setIsMenuOpen(false)
  }, [])

  const toggleMenu = useCallback(() => {
    setIsMenuOpen((prev) => !prev)
  }, [])

  useEffect(() => {
    if (!isMenuOpen) {
      return
    }

    const focusableElements = panelRef.current
      ? Array.from(panelRef.current.querySelectorAll<HTMLElement>(focusableSelector))
      : []

    const menuButton = menuButtonRef.current

    if (menuButton) {
      focusableElements.push(menuButton)
    }

    const firstElement = focusableElements[0]

    if (firstElement) {
      const timeout = window.setTimeout(() => firstElement.focus(), 40)
      return () => window.clearTimeout(timeout)
    }

    menuButton?.focus()
  }, [isMenuOpen])

  useEffect(() => {
    if (!isMenuOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        handleCloseMenu()
        return
      }

      if (event.key !== "Tab") {
        return
      }

      const focusableElements = panelRef.current
        ? Array.from(panelRef.current.querySelectorAll<HTMLElement>(focusableSelector))
        : []
      const menuButton = menuButtonRef.current

      if (menuButton) {
        focusableElements.push(menuButton)
      }

      if (focusableElements.length === 0) {
        event.preventDefault()
        menuButton?.focus()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      const activeElement = document.activeElement as HTMLElement | null

      if (event.shiftKey) {
        if (activeElement === firstElement || activeElement === panelRef.current) {
          event.preventDefault()
          lastElement?.focus()
        }
        return
      }

      if (activeElement === lastElement) {
        event.preventDefault()
        firstElement?.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [handleCloseMenu, isMenuOpen])

  useEffect(() => {
    if (!isMenuOpen) {
      return
    }

    const originalOverflow = document.body.style.overflow
    const originalPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    document.body.style.overflow = "hidden"
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }

    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.paddingRight = originalPaddingRight
    }
  }, [isMenuOpen])

  useEffect(() => {
    if (wasMenuOpenRef.current && !isMenuOpen) {
      menuButtonRef.current?.focus()
    }
    wasMenuOpenRef.current = isMenuOpen
  }, [isMenuOpen])

  useEffect(() => {
    if (isMenuOpen) {
      handleCloseMenu()
    }
  }, [handleCloseMenu, isMenuOpen, pathname])

  const menuLabel = isMenuOpen ? "Close navigation menu" : "Open navigation menu"

  const overlayClasses = useMemo(
    () =>
      cn(
        "fixed inset-0 z-40 flex justify-end bg-black/70 backdrop-blur-md transition-opacity",
        reducedMotion ? "duration-0" : "duration-300 ease-out",
        isMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      ),
    [isMenuOpen, reducedMotion],
  )

  const panelClasses = useMemo(
    () =>
      cn(
        "relative flex h-full w-full max-w-full flex-col gap-8 overflow-y-auto bg-background/95 px-6 pb-12 pt-24 text-base shadow-[0_24px_72px_rgba(0,0,0,0.45)]",
        "sm:px-8",
        "lg:max-w-md lg:rounded-l-3xl",
        reducedMotion ? "duration-0" : "duration-300 ease-out",
        isMenuOpen ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0",
      ),
    [isMenuOpen, reducedMotion],
  )

  const handleOverlayClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.target === overlayRef.current) {
        handleCloseMenu()
      }
    },
    [handleCloseMenu],
  )

  const handleNavItemClick = useCallback(() => {
    handleCloseMenu()
  }, [handleCloseMenu])

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-accent to-primary/80 shadow-[0_6px_24px_rgba(0,0,0,0.25)]">
            <Image src="/images/logo.png" alt="Mintmine Pro" width={28} height={28} priority className="rounded-xl" />
          </span>
          <span className="text-lg font-semibold sm:text-xl">Mintmine Pro</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-8 xl:flex">
          <ul className="flex items-center gap-6 text-sm font-medium">
            {NAV_ITEMS.map((item) => {
              const isActive = item.href === "/" ? pathname === item.href : pathname?.startsWith(item.href)

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "relative inline-flex items-center rounded-xl px-2 py-1.5 transition-colors",
                      reducedMotion ? "" : "duration-200 ease-out",
                      isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="hidden items-center gap-4 xl:flex">
          <ThemeToggle />
          <Link href="/auth/login">
            <Button variant="ghost" className="h-11 rounded-xl px-5">
              Sign In
            </Button>
          </Link>
          <Link href="/auth/register">
            <Button className="h-11 rounded-xl px-6 shadow-[0_12px_32px_rgba(0,0,0,0.25)]">
              Get Started
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-3 xl:hidden">
          <ThemeToggle className="hidden lg:flex" />
          <button
            ref={menuButtonRef}
            type="button"
            onClick={toggleMenu}
            aria-expanded={isMenuOpen}
            aria-controls="site-navigation-panel"
            aria-label={menuLabel}
            className={cn(
              "inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-background/90 text-foreground shadow-[0_6px_24px_rgba(0,0,0,0.25)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              reducedMotion ? "" : "duration-200 ease-out",
            )}
          >
            <span className="relative block h-4 w-6">
              <span
                className={cn(
                  "absolute left-0 top-0 block h-[2px] w-full rounded-full bg-current",
                  reducedMotion ? "" : "transition-transform duration-300 ease-out",
                  isMenuOpen ? "translate-y-[7px] rotate-45" : "translate-y-0 rotate-0",
                )}
              />
              <span
                className={cn(
                  "absolute left-0 top-1/2 block h-[2px] w-full -translate-y-1/2 rounded-full bg-current",
                  reducedMotion ? "" : "transition-opacity duration-200 ease-out",
                  isMenuOpen ? "opacity-0" : "opacity-100",
                )}
              />
              <span
                className={cn(
                  "absolute bottom-0 left-0 block h-[2px] w-full rounded-full bg-current",
                  reducedMotion ? "" : "transition-transform duration-300 ease-out",
                  isMenuOpen ? "-translate-y-[7px] -rotate-45" : "translate-y-0 rotate-0",
                )}
              />
            </span>
          </button>
        </div>
      </div>

      <div
        ref={overlayRef}
        className={overlayClasses}
        onMouseDown={handleOverlayClick}
        aria-hidden={!isMenuOpen}
      >
        <div
          ref={panelRef}
          id="site-navigation-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Primary navigation"
          className={panelClasses}
        >
          <div className="flex flex-col gap-10">
            <nav aria-label="Mobile">
              <ul className="flex flex-col gap-3">
                {NAV_ITEMS.map((item, index) => {
                  const isActive = item.href === "/" ? pathname === item.href : pathname?.startsWith(item.href)

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={handleNavItemClick}
                        className={cn(
                          "block rounded-2xl px-4 py-3 text-base font-medium text-foreground transition-transform transition-colors",
                          reducedMotion ? "" : "duration-200 ease-out hover:-translate-y-0.5",
                          isActive ? "bg-primary/15" : "bg-background/70 hover:bg-primary/20",
                        )}
                        style={!reducedMotion ? { transitionDelay: `${index * 40 + 80}ms` } : undefined}
                      >
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>

            <div className="flex flex-col gap-3">
              <Link href="/auth/login" onClick={handleNavItemClick}>
                <Button
                  variant="ghost"
                  className={cn(
                    "h-11 w-full justify-center rounded-2xl border border-border/60 bg-background/80",
                    reducedMotion ? "" : "transition-colors duration-200 ease-out hover:bg-primary/10",
                  )}
                >
                  Sign In
                </Button>
              </Link>
              <Link href="/auth/register" onClick={handleNavItemClick}>
                <Button
                  className={cn(
                    "h-11 w-full justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_20px_48px_rgba(0,0,0,0.35)]",
                    reducedMotion ? "" : "transition-transform transition-colors duration-200 ease-out hover:-translate-y-0.5",
                  )}
                >
                  Get Started
                </Button>
              </Link>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground">Theme</span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
