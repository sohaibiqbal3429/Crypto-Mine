"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, ArrowDownToLine, ArrowUpRight, Gauge, Layers, Wallet } from "lucide-react"

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
      subtitle: "Cumulative production",
      value: formatCurrency(kpis.totalEarning),
      icon: Layers,
      tone: "text-primary",
    },
    {
      title: "Vault Balance",
      subtitle: "Secured in cold stack",
      value: formatCurrency(kpis.totalBalance),
      icon: Wallet,
      tone: "text-accent",
    },
    {
      title: "Instantly Withdrawable",
      subtitle: "Liquid right now",
      value: formatCurrency(kpis.currentBalance),
      icon: ArrowUpRight,
      tone: "text-chart-2",
    },
    {
      title: "Total Payouts Sent",
      subtitle: "Released to crew",
      value: formatCurrency(kpis.totalWithdraw),
      icon: ArrowDownToLine,
      tone: "text-chart-4",
    },
    {
      title: "Payouts in Queue",
      subtitle: "Awaiting clearance",
      value: formatCurrency(kpis.pendingWithdraw),
      icon: Gauge,
      tone: "text-chart-5",
    },
    {
      title: "Live Participants",
      subtitle: "Network crew connected",
      value: kpis.activeMembers.toLocaleString(),
      icon: Activity,
      tone: "text-muted-foreground",
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card, index) => (
        <Card
          key={index}
          className="relative overflow-hidden rounded-xl border border-border/70 bg-card/70 shadow-[0_12px_40px_-22px_rgba(0,0,0,0.6)]"
        >
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div className="space-y-1">
              <CardTitle className="text-sm font-semibold tracking-tight text-muted-foreground">{card.title}</CardTitle>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">{card.subtitle}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/70 bg-secondary/70 text-primary">
              <card.icon className="h-5 w-5" aria-hidden />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-2xl font-bold tracking-tight text-foreground">{card.value}</div>
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-muted-foreground/80">
              <span className="font-semibold text-primary">Live feed</span>
              <span className={cn("font-semibold", card.tone)}>Synced</span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary">
              <div className="h-full w-[76%] rounded-full bg-gradient-to-r from-primary to-accent" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
