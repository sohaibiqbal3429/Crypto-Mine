"use client"

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import * as DialogPrimitive from "@radix-ui/react-dialog"

import { PRIMARY_NAV_ITEMS, ADMIN_NAV_ITEM } from "@/components/layout/nav-config"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

interface MobileNavDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  anchorRef: React.RefObject<HTMLButtonElement>
}

interface DrawerUser {
  id: string
  name: string
  email: string
  role: string
  avatarUrl?: string | null
}

export function MobileNavDrawer({ open, onOpenChange, anchorRef }: MobileNavDrawerProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [shouldRender, setShouldRender] = useState(false)
  const [isLoadingUser, setIsLoadingUser] = useState(false)
  const [userError, setUserError] = useState<string | null>(null)
  const [user, setUser] = useState<DrawerUser | null>(null)
  const scrollYRef = useRef(0)
  const isBodyLockedRef = useRef(false)
  const titleId = useId()
  const liveRegionRef = useRef<HTMLDivElement | null>(null)
  const hasFetchedUser = useRef(false)

  useEffect(() => {
    if (open) {
      setShouldRender(true)
    }
  }, [open])

  useEffect(() => {
    if (open && !hasFetchedUser.current) {
      hasFetchedUser.current = true
      setIsLoadingUser(true)
      void fetch("/api/auth/me")
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Failed to load user")
          }
          const data = (await response.json()) as { user?: DrawerUser }
          if (data.user) {
            setUser(data.user)
          }
          setUserError(null)
        })
        .catch((error) => {
          console.error(error)
          setUserError("Unable to load account details")
        })
        .finally(() => {
          setIsLoadingUser(false)
        })
    }
  }, [open])

  useEffect(() => {
    if (!shouldRender) {
      return
    }

    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = open ? "Navigation drawer opened" : "Navigation drawer closed"
    }
  }, [open, shouldRender])

  useEffect(() => {
    const body = document.body

    if (open) {
      scrollYRef.current = window.scrollY
      body.style.top = `-${scrollYRef.current}px`
      body.style.position = "fixed"
      body.style.width = "100%"
      isBodyLockedRef.current = true
    } else if (isBodyLockedRef.current) {
      body.style.removeProperty("position")
      body.style.removeProperty("top")
      body.style.removeProperty("width")
      window.scrollTo({ top: scrollYRef.current })
      isBodyLockedRef.current = false
    }

    return () => {
      body.style.removeProperty("position")
      body.style.removeProperty("top")
      body.style.removeProperty("width")
      if (isBodyLockedRef.current) {
        window.scrollTo({ top: scrollYRef.current })
        isBodyLockedRef.current = false
      }
    }
  }, [open])

  const previousPathnameRef = useRef(pathname)

  useEffect(() => {
    if (pathname !== previousPathnameRef.current) {
      previousPathnameRef.current = pathname

      if (open) {
        onOpenChange(false)
      }
    }
  }, [pathname, open, onOpenChange])

  const initials = useMemo(() => {
    if (!user?.name) {
      return ""
    }
    return user.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((segment) => segment.charAt(0).toUpperCase())
      .join("")
  }, [user?.name])

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      onOpenChange(false)
      router.push("/auth/login")
    } catch (error) {
      console.error("Logout error", error)
    }
  }, [onOpenChange, router])

  const linkClasses = useCallback(
    (isActive: boolean) =>
      cn(
        "flex items-center gap-3 rounded-2xl px-3 py-3 text-base font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "ring-offset-background",
        isActive
          ? "bg-primary/15 text-primary"
          : "text-foreground hover:bg-muted/70 hover:text-foreground",
      ),
    [],
  )

  const renderNavItems = () => (
    <ul className="space-y-1">
      {PRIMARY_NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              prefetch={item.href === "/team" ? true : undefined}
              onClick={() => onOpenChange(false)}
              className={linkClasses(isActive)}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon className="h-5 w-5" aria-hidden />
              <span className="truncate">{item.name}</span>
            </Link>
          </li>
        )
      })}
      {user?.role === "admin" && (
        <li key={ADMIN_NAV_ITEM.href}>
          <Link
            href={ADMIN_NAV_ITEM.href}
            prefetch={ADMIN_NAV_ITEM.href === "/team" ? true : undefined}
            onClick={() => onOpenChange(false)}
            className={linkClasses(
              pathname === ADMIN_NAV_ITEM.href || pathname.startsWith(`${ADMIN_NAV_ITEM.href}/`),
            )}
            aria-current={
              pathname === ADMIN_NAV_ITEM.href || pathname.startsWith(`${ADMIN_NAV_ITEM.href}/`)
                ? "page"
                : undefined
            }
          >
            <ADMIN_NAV_ITEM.icon className="h-5 w-5" aria-hidden />
            <span className="truncate">{ADMIN_NAV_ITEM.name}</span>
          </Link>
        </li>
      )}
    </ul>
  )

  if (!shouldRender) {
    return null
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[900] bg-black/50 opacity-0 transition-opacity duration-[240ms] ease-[cubic-bezier(.2,.8,.2,1)] data-[state=open]:opacity-100" />
        <DialogPrimitive.Content
          id="mobile-drawer"
          aria-modal="true"
          aria-labelledby={titleId}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            anchorRef.current?.focus()
          }}
          className={cn(
            "pointer-events-auto fixed left-0 top-0 z-[1000] flex h-screen w-[86vw] flex-col overflow-hidden border-r border-border/60 bg-card text-card-foreground shadow-2xl shadow-black/20 will-change-[transform,opacity]",
            "transition-[transform,opacity] duration-[240ms] ease-[cubic-bezier(.2,.8,.2,1)]",
            "data-[state=closed]:-translate-x-6 data-[state=closed]:scale-[0.98] data-[state=closed]:opacity-0",
            "data-[state=open]:translate-x-0 data-[state=open]:scale-100 data-[state=open]:opacity-100",
          )}
        >
          <div className="flex h-full flex-col">
            <div className="space-y-4 px-5 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
              <DialogPrimitive.Title id={titleId} className="sr-only">
                Mobile navigation
              </DialogPrimitive.Title>
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  {user?.avatarUrl ? (
                    <AvatarImage src={user.avatarUrl} alt={user.name ?? "User avatar"} />
                  ) : (
                    <AvatarFallback className="text-base font-semibold">{initials || "?"}</AvatarFallback>
                  )}
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold leading-tight truncate">
                    {user?.name ?? (isLoadingUser ? "Loading..." : "Guest")}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {user?.email ?? (userError ? "Sign in required" : "")}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-10 rounded-xl px-4 text-sm font-medium"
                asChild
              >
                <Link href="/profile" onClick={() => onOpenChange(false)}>
                  View Profile
                </Link>
              </Button>
            </div>

            <Separator className="border-border/60" />

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {renderNavItems()}
            </div>

            <Separator className="border-border/60" />

            <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
              <Button
                variant="ghost"
                className="w-full justify-start rounded-2xl px-4 py-3 text-base font-medium"
                onClick={() => {
                  void handleLogout()
                }}
              >
                Sign out
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
        <div ref={liveRegionRef} className="sr-only" aria-live="polite" />
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
