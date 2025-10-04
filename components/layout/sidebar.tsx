"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  ActivitySquare,
  Compass,
  FileText,
  Grid2x2,
  Hexagon,
  History,
  LogOut,
  Menu,
  RadioTower,
  Settings,
  ShieldCheck,
  Users,
  Wallet2,
} from "lucide-react"

const navigationGroups = [
  {
    title: "Command",
    items: [
      { name: "Command Deck", href: "/dashboard", icon: Grid2x2 },
      { name: "Live Reactors", href: "/mining", icon: RadioTower },
      { name: "Signals", href: "/tasks", icon: ActivitySquare },
    ],
  },
  {
    title: "Finance",
    items: [
      { name: "Vault Wallet", href: "/wallet", icon: Wallet2 },
      { name: "Transactions", href: "/transactions", icon: History },
      { name: "Safeguards", href: "/e-wallet", icon: ShieldCheck },
    ],
  },
  {
    title: "Community",
    items: [
      { name: "Alliance Grid", href: "/team", icon: Users },
      { name: "Launchpad", href: "/coins", icon: Hexagon },
      { name: "Navigator", href: "/support", icon: Compass },
      { name: "Manifest", href: "/terms", icon: FileText },
    ],
  },
]

interface SidebarProps {
  user?: {
    name: string
    email: string
    referralCode: string
    role?: string
  }
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      router.push("/auth/login")
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="relative flex h-20 items-center justify-between border-b border-sidebar-border px-6">
        <div className="flex items-center gap-3">
          <div className="habitat-glow flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-400 to-fuchsia-500 text-xl font-bold text-slate-950 shadow-[0_15px_35px_rgba(56,189,248,0.35)]">
            🍏
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.4em] text-sidebar-foreground/70">Apple Mine</p>
            <p className="-mt-1 text-base font-semibold text-sidebar-foreground">Habitat Console</p>
          </div>
        </div>
        <div className="md:hidden flex items-center gap-3">
          <NotificationBell />
          <ThemeToggle />
        </div>
        <div className="pointer-events-none absolute inset-x-6 -bottom-6 h-24 rounded-full bg-[radial-gradient(circle,_rgba(125,211,252,0.18),_transparent_70%)]" />
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
        {navigationGroups.map((group) => (
          <div key={group.title} className="space-y-3">
            <p className="px-3 text-xs font-semibold uppercase tracking-[0.35em] text-sidebar-foreground/50">
              {group.title}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[0_12px_30px_rgba(56,189,248,0.25)]"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }`}
                    onClick={() => setOpen(false)}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    <span>{item.name}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}

        {user?.role === "admin" && (
          <div className="space-y-3">
            <p className="px-3 text-xs font-semibold uppercase tracking-[0.35em] text-sidebar-foreground/50">Admin</p>
            <Link
              href="/admin"
              className={`group flex items-center rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors ${
                pathname === "/admin" || pathname.startsWith("/admin/")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[0_12px_30px_rgba(56,189,248,0.25)]"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
              onClick={() => setOpen(false)}
            >
              <Settings className="mr-3 h-5 w-5" /> Admin Deck
            </Link>
          </div>
        )}
      </nav>

      {user && (
        <div className="border-t border-sidebar-border p-5">
          <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent/30 p-4 text-xs text-sidebar-foreground/70">
            <p className="text-sm font-semibold text-sidebar-foreground">{user.name}</p>
            <p className="truncate text-sidebar-foreground/70">{user.email}</p>
            <p className="mt-2 font-mono text-xs uppercase tracking-[0.35em] text-sidebar-foreground/60">
              Ident: {user.referralCode}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOpen(false)
              void handleLogout()
            }}
            className="mt-4 w-full justify-start rounded-2xl text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      )}
    </div>
  )

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden h-14 w-14">
            <Menu className="h-10 w-10" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 border-r border-white/10 bg-[#030614] p-0 text-foreground [&_[data-slot='sheet-close']]:hidden">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      <div className="hidden md:fixed md:inset-y-0 md:flex md:w-72 md:flex-col">
        <SidebarContent />
      </div>

      <div className="fixed top-8 right-6 z-50 hidden items-center gap-3 md:flex">
        <NotificationBell />
        <ThemeToggle />
      </div>
    </>
  )
}
