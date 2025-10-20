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
  { name: "Home", href: "/dashboard", icon: Home },
  { name: "Mining", href: "/mining", icon: Pickaxe },
  { name: "Deposit", href: "/deposit", icon: ArrowDownLeft },
  { name: "Withdraw", href: "/withdraw", icon: ArrowUpRight },
  { name: "Task", href: "/tasks", icon: BarChart3 },
  { name: "Team", href: "/team", icon: Users },
  { name: "List Coin", href: "/coins", icon: Coins },
  { name: "E-Wallet", href: "/e-wallet", icon: CreditCard },
  { name: "History", href: "/transactions", icon: History },
  { name: "Support", href: "/support", icon: HelpCircle },
  { name: "Profile", href: "/profile", icon: User },
  { name: "Terms", href: "/terms", icon: FileText },
]

export const ADMIN_NAV_ITEM: AppNavItem = {
  name: "Admin Panel",
  href: "/admin",
  icon: Settings,
}

const PAGE_TITLE_RULES: Array<{ pattern: RegExp; title: string }> = [
  { pattern: /^\/$/, title: "Welcome" },
  { pattern: /^\/dashboard(?:\/.+)?$/, title: "Dashboard" },
  { pattern: /^\/mining(?:\/.+)?$/, title: "Mining" },
  { pattern: /^\/deposit(?:\/.+)?$/, title: "Deposit" },
  { pattern: /^\/withdraw(?:\/.+)?$/, title: "Withdraw" },
  { pattern: /^\/e-wallet(?:\/.+)?$/, title: "E-Wallet" },
  { pattern: /^\/transactions(?:\/.+)?$/, title: "History" },
  { pattern: /^\/tasks(?:\/.+)?$/, title: "Tasks" },
  { pattern: /^\/team(?:\/.+)?$/, title: "Team" },
  { pattern: /^\/coins(?:\/.+)?$/, title: "Coin Listings" },
  { pattern: /^\/support(?:\/.+)?$/, title: "Support" },
  { pattern: /^\/profile(?:\/.+)?$/, title: "Profile" },
  { pattern: /^\/terms(?:\/.+)?$/, title: "Terms" },
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
  return fallback?.name ?? "Mintmine Pro"
}
