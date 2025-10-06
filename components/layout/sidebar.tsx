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
    <div className="flex h-full flex-col bg-sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-6">
        <div className="flex items-center space-x-2">
          <Image src="/images/logo.png" alt="Mintmine Pro" width={32} height={32} className="rounded-lg" />
          <span className="text-lg font-bold text-sidebar-foreground">Mintmine Pro</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {PRIMARY_NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </Link>
          )
        })}

        {user?.role === "admin" && (
          <Link
            href={ADMIN_NAV_ITEM.href}
            className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              pathname === ADMIN_NAV_ITEM.href || pathname.startsWith(`${ADMIN_NAV_ITEM.href}/`)
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <ADMIN_NAV_ITEM.icon className="mr-3 h-5 w-5" />
            {ADMIN_NAV_ITEM.name}
          </Link>
        )}
      </nav>

      {/* User info and logout */}
      {user && (
        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 text-xs text-sidebar-foreground/70">
            <div className="font-medium">{user.name}</div>
            <div className="truncate">{user.email}</div>
            <div className="mt-1 font-mono text-xs">Code: {user.referralCode}</div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void handleLogout()
            }}
            className="w-full justify-start text-sidebar-foreground "
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
