"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import Image from "next/image"
import { LogOut } from "lucide-react"

import { PRIMARY_NAV_ITEMS, ADMIN_NAV_ITEM } from "@/components/layout/nav-config"
import { Button } from "@/components/ui/button"

interface SidebarProps {
  user?: {
    name: string
    email: string
    referralCode: string
    role?: string
    profileAvatar?: string
  }
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      router.push("/auth/login")
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-sidebar/80 backdrop-blur-2xl border-r border-sidebar-border/60 shadow-lg">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border/60 px-6">
        <Link href="/" prefetch className="group flex items-center space-x-3">
          <div className="relative rounded-2xl bg-gradient-to-br from-primary to-accent p-2 shadow-lg shadow-primary/25">
            <Image src="/logo.png" alt="CryptoMine" width={28} height={28} className="h-7 w-7" priority />
            <span className="absolute -right-1 -bottom-1 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-white" />
          </div>
          <div className="leading-tight">
            <span className="block text-xs uppercase tracking-[0.08em] text-sidebar-foreground/70">CryptoMine</span>
            <span className="text-lg font-black text-sidebar-foreground">MintMine Pro</span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 px-4 py-5">
        {PRIMARY_NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.name}
              href={item.href}
              prefetch={item.href === "/team" ? true : undefined}
              className={`group relative flex items-center rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? "bg-gradient-to-r from-primary/15 via-accent/15 to-transparent text-sidebar-foreground shadow-[0_10px_30px_-12px_rgba(124,58,237,0.35)]"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              <span
                className={`absolute left-0 top-2 bottom-2 w-1 rounded-full ${
                  isActive ? "bg-gradient-to-b from-primary to-accent" : "bg-transparent group-hover:bg-sidebar-ring"
                }`}
              />
              <div
                className={`mr-3 flex h-9 w-9 items-center justify-center rounded-xl border border-sidebar-border/70 backdrop-blur-md transition-all duration-200 ${
                  isActive
                    ? "bg-gradient-to-br from-primary/20 to-accent/30 text-primary shadow-inner"
                    : "bg-sidebar/60 text-sidebar-foreground/70 group-hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span>{item.name}</span>
                <span className="text-[11px] font-normal text-sidebar-foreground/60">{item.description ?? ""}</span>
              </div>
            </Link>
          )
        })}

        {user?.role === "admin" && (
          <Link
            href={ADMIN_NAV_ITEM.href}
            prefetch={ADMIN_NAV_ITEM.href === "/team" ? true : undefined}
            className={`group relative flex items-center rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
              pathname === ADMIN_NAV_ITEM.href || pathname.startsWith(`${ADMIN_NAV_ITEM.href}/`)
                ? "bg-gradient-to-r from-primary/15 via-accent/15 to-transparent text-sidebar-foreground shadow-[0_10px_30px_-12px_rgba(124,58,237,0.35)]"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            }`}
          >
            <span
              className={`absolute left-0 top-2 bottom-2 w-1 rounded-full ${
                pathname === ADMIN_NAV_ITEM.href || pathname.startsWith(`${ADMIN_NAV_ITEM.href}/`)
                  ? "bg-gradient-to-b from-primary to-accent"
                  : "bg-transparent group-hover:bg-sidebar-ring"
              }`}
            />
            <div
              className={`mr-3 flex h-9 w-9 items-center justify-center rounded-xl border border-sidebar-border/70 backdrop-blur-md transition-all duration-200 ${
                pathname === ADMIN_NAV_ITEM.href || pathname.startsWith(`${ADMIN_NAV_ITEM.href}/`)
                  ? "bg-gradient-to-br from-primary/20 to-accent/30 text-primary shadow-inner"
                  : "bg-sidebar/60 text-sidebar-foreground/70 group-hover:text-sidebar-foreground"
              }`}
            >
              <ADMIN_NAV_ITEM.icon className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span>{ADMIN_NAV_ITEM.name}</span>
              <span className="text-[11px] font-normal text-sidebar-foreground/60">Admin controls</span>
            </div>
          </Link>
        )}
      </nav>

      {/* User info and logout */}
      {user && (
        <div className="border-t border-sidebar-border/60 px-5 py-4">
          <div className="mb-3 flex items-center gap-3 rounded-2xl border border-sidebar-border/60 bg-sidebar/70 p-3 backdrop-blur-xl shadow-inner shadow-primary/5">
            <Image
              src={`/avatars/${user.profileAvatar ?? "avatar-01"}.svg`}
              alt={`${user.name}'s avatar`}
              width={48}
              height={48}
              className="h-12 w-12 rounded-full border border-sidebar-border bg-sidebar"
            />
            <div className="text-xs text-sidebar-foreground/80">
              <div className="text-sm font-semibold text-sidebar-foreground">{user.name}</div>
              <div className="truncate">{user.email}</div>
              <div className="mt-1 inline-flex rounded-full bg-sidebar-accent px-2 py-1 font-mono text-[11px] text-sidebar-accent-foreground">
                Code: {user.referralCode}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void handleLogout()
            }}
            className="w-full justify-center rounded-full border border-transparent bg-gradient-to-r from-primary/15 to-accent/20 text-sidebar-foreground hover:from-primary/25 hover:to-accent/25"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      )}
    </div>
  )

  return (
    <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
      <SidebarContent />
    </aside>
  )
}
