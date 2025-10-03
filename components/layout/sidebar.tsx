"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { ThemeToggle } from "@/components/theme-toggle"
import Image from "next/image"
import {
  Home,
  BarChart3,
  Users,
  Coins,
  Pickaxe,
  TrendingUp,
  Wallet,
  CreditCard,
  History,
  HelpCircle,
  User,
  FileText,
  Menu,
  LogOut,
  Settings,
} from "lucide-react"

const navigation = [
  { name: "Home", href: "/dashboard", icon: Home },
  { name: "Mining", href: "/mining", icon: Pickaxe },
  { name: "Wallet", href: "/wallet", icon: Wallet },
  { name: "Task", href: "/tasks", icon: BarChart3 },
  { name: "Team", href: "/team", icon: Users },
  { name: "List Coin", href: "/coins", icon: Coins },
  { name: "E-Wallet", href: "/e-wallet", icon: CreditCard },
  { name: "History", href: "/transactions", icon: History },
  { name: "Support", href: "/support", icon: HelpCircle },
  { name: "Profile", href: "/profile", icon: User },
  { name: "Terms", href: "/terms", icon: FileText },
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
        <div className="md:hidden mt-2 flex items-center gap-2">
          <NotificationBell />
          <ThemeToggle />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
              onClick={() => setOpen(false)}
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </Link>
          )
        })}

        {user?.role === "admin" && (
          <Link
            href="/admin"
            className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              pathname === "/admin"
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
            onClick={() => setOpen(false)}
          >
            <Settings className="mr-3 h-5 w-5" />
            Admin Panel
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
            onClick={handleLogout}
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
    <>
      {/* Mobile sidebar */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden h-14 w-14">
            <Menu className="h-10 w-10" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0 [&_[data-slot='sheet-close']]:hidden">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <SidebarContent />
      </div>

      <div className="fixed top-8 right-6 z-50 hidden items-center gap-3 md:flex">
        <NotificationBell />
        <ThemeToggle />
      </div>
    </>
  )
}
