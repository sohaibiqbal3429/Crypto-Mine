"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, Wallet, DollarSign, ArrowDownToLine, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

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
  const formatCurrency = (amount: number) =>
    amount.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

  const cards = [
    {
      title: "Lifetime Yield",
      subtitle: "Cumulative network payouts",
      value: formatCurrency(kpis.totalEarning),
      icon: TrendingUp,
      tone: "text-emerald-300",
      badge: "bg-emerald-500/20 text-emerald-100",
    },
    {
      title: "Vault Balance",
      value: formatCurrency(kpis.totalBalance),
      subtitle: "All secured funds",
      icon: Wallet,
      tone: "text-cyan-300",
      badge: "bg-cyan-500/20 text-cyan-100",
    },
    {
      title: "Inst. Withdrawable",
      value: formatCurrency(kpis.currentBalance),
      subtitle: "Ready for cash out",
      icon: DollarSign,
      tone: "text-amber-300",
      badge: "bg-amber-500/20 text-amber-100",
    },
    {
      title: "Total Payouts Sent",
      value: formatCurrency(kpis.totalWithdraw),
      subtitle: "Completed disbursements",
      icon: ArrowDownToLine,
      tone: "text-blue-300",
      badge: "bg-blue-500/20 text-blue-100",
    },
    {
      title: "Payouts in Queue",
      value: formatCurrency(kpis.pendingWithdraw),
      subtitle: "Processing pipeline",
      icon: Clock,
      tone: "text-fuchsia-300",
      badge: "bg-fuchsia-500/20 text-fuchsia-100",
    },
  ]

  return (
    <div className="mb-6 grid gap-4 md:gap-6 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((card, index) => (
        <Card
          key={index}
          className="group relative h-full overflow-hidden border border-slate-800/80 bg-slate-900/80 shadow-lg shadow-emerald-500/10 transition hover:-translate-y-[2px]"
        >
          <div className="absolute inset-0 opacity-70">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.08),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(6,182,212,0.06),transparent_45%)]" />
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400/60 via-cyan-400/40 to-blue-500/40" />
          </div>
          <div className="relative flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="text-sm font-semibold text-slate-100">{card.title}</CardTitle>
                <p className="text-xs text-slate-400">{card.subtitle ?? "Live synced with backend"}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-800/80 bg-slate-900/80 text-cyan-200">
                <card.icon className="h-5 w-5" />
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-white">{card.value}</div>
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-slate-500">
              <span>live feed</span>
              <span className={cn("rounded-full px-2 py-1 text-[10px] font-semibold", card.badge)}>synced</span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
