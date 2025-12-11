import type { LucideIcon } from "lucide-react"
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Coins,
  CreditCard,
  FileText,
  HelpCircle,
  History,
  Home,
  Pickaxe,
  Settings,
  User,
  Users,
} from "lucide-react"

export type AppNavItem = {
  name: string
  href: string
  icon: LucideIcon
}

export const PRIMARY_NAV_ITEMS: AppNavItem[] = [
  { name: "Overview", href: "/dashboard", icon: Home },
  { name: "Mining Hub", href: "/mining", icon: Pickaxe },
  { name: "Top-Up Center", href: "/deposit", icon: ArrowDownLeft },
  { name: "Cash Out", href: "/withdraw", icon: ArrowUpRight },
  { name: "Missions & Quests", href: "/tasks", icon: BarChart3 },
  { name: "Network Crew", href: "/team", icon: Users },
  { name: "Asset Catalog", href: "/coins", icon: Coins },
  { name: "Wallet Hub", href: "/e-wallet", icon: CreditCard },
  { name: "Activity Timeline", href: "/transactions", icon: History },
  { name: "Help Desk", href: "/support", icon: HelpCircle },
  { name: "Account Center", href: "/profile", icon: User },
  { name: "Knowledge Base", href: "/terms", icon: FileText },
]

export const ADMIN_NAV_ITEM: AppNavItem = {
  name: "Admin Panel",
  href: "/admin",
  icon: Settings,
}

const PAGE_TITLE_RULES: Array<{ pattern: RegExp; title: string }> = [
  { pattern: /^\/$/, title: "Welcome" },
  { pattern: /^\/dashboard(?:\/.+)?$/, title: "Overview" },
  { pattern: /^\/mining(?:\/.+)?$/, title: "Mining Hub" },
  { pattern: /^\/deposit(?:\/.+)?$/, title: "Top-Up Center" },
  { pattern: /^\/withdraw(?:\/.+)?$/, title: "Cash Out" },
  { pattern: /^\/e-wallet(?:\/.+)?$/, title: "Wallet Hub" },
  { pattern: /^\/transactions(?:\/.+)?$/, title: "Activity Timeline" },
  { pattern: /^\/tasks(?:\/.+)?$/, title: "Missions & Quests" },
  { pattern: /^\/team(?:\/.+)?$/, title: "Network Crew" },
  { pattern: /^\/coins(?:\/.+)?$/, title: "Asset Catalog" },
  { pattern: /^\/support(?:\/.+)?$/, title: "Help Desk" },
  { pattern: /^\/profile(?:\/.+)?$/, title: "Account Center" },
  { pattern: /^\/terms(?:\/.+)?$/, title: "Knowledge Base" },
  { pattern: /^\/admin(?:\/.+)?$/, title: "Admin Panel" },
]

export function getPageTitle(pathname: string): string {
  const match = PAGE_TITLE_RULES.find(({ pattern }) => pattern.test(pathname))
  if (match) {
    return match.title
  }

  const fallback = PRIMARY_NAV_ITEMS.find((item) =>
    pathname === item.href || pathname.startsWith(`${item.href}/`),
  )
  return fallback?.name ?? "5gbotify"
}
