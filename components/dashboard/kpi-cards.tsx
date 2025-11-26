"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, Wallet, DollarSign, ArrowDownToLine, Clock, Trophy } from "lucide-react"

interface KPICardsProps {
  kpis: {
    totalEarning: number
    totalBalance: number
    currentBalance: number
    activeMembers: number
    totalWithdraw: number
    pendingWithdraw: number
    teamReward: number
    teamRewardToday?: number
  }
}

export function KPICards({ kpis }: KPICardsProps) {
  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`

  const cards = [
    {
      title: "Total Balance",
      value: formatCurrency(kpis.totalBalance),
      icon: Wallet,
      accent: "from-primary to-accent",
      pill: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/40 dark:text-emerald-200",
    },
    {
      title: "Current Balance",
      value: formatCurrency(kpis.currentBalance),
      icon: DollarSign,
      accent: "from-accent to-primary",
      pill: "text-sky-700 bg-sky-50 dark:bg-sky-900/40 dark:text-sky-200",
    },
    {
      title: "Total Withdraw",
      value: formatCurrency(kpis.totalWithdraw),
      icon: ArrowDownToLine,
      accent: "from-[#ff7a7a] via-[#ff5fa2] to-[#7c3aed]",
      pill: "text-rose-700 bg-rose-50 dark:bg-rose-900/40 dark:text-rose-200",
    },
    {
      title: "Pending Withdraw",
      value: formatCurrency(kpis.pendingWithdraw),
      icon: Clock,
      accent: "from-[#fde68a] via-[#7c3aed] to-[#22d3ee]",
      pill: "text-amber-700 bg-amber-50 dark:bg-amber-900/40 dark:text-amber-200",
    },
  ]

  return (
    <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
      {cards.map((card, index) => (
        <Card
          key={index}
          className="relative overflow-hidden rounded-2xl border-border/60 bg-gradient-to-br from-white/80 to-white/60 shadow-xl shadow-primary/5 dark:from-white/5 dark:to-white/0"
        >
          <div className={`absolute inset-0 opacity-60 bg-gradient-to-br ${card.accent}`} />
          <div className="relative">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="text-sm font-semibold text-muted-foreground/90">{card.title}</CardTitle>
                <p className="text-xs text-muted-foreground/80">Live synced with backend</p>
              </div>
              <div className="group rounded-2xl border border-white/60 bg-white/80 p-3 text-primary shadow-lg backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-2xl dark:border-white/10 dark:bg-white/5">
                <card.icon className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-3xl font-black tracking-tight text-foreground">{card.value}</div>
              <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${card.pill}`}>
                Updated in real time
              </div>
            </CardContent>
          </div>
        </Card>
      ))}
    </div>
  )
}
