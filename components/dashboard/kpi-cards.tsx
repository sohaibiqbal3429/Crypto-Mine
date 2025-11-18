"use client"

import { ArrowDownToLine, Clock, DollarSign, Wallet } from "lucide-react"

const gradients = [
  "from-purple-500/40 via-fuchsia-500/30 to-cyan-400/30",
  "from-emerald-400/30 via-teal-400/20 to-cyan-500/30",
  "from-rose-400/30 via-orange-400/20 to-amber-400/30",
  "from-cyan-400/30 via-blue-500/20 to-indigo-500/30",
]

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
      hint: "Across vaults",
    },
    {
      title: "Current Balance",
      value: formatCurrency(kpis.currentBalance),
      icon: DollarSign,
      hint: "Ready to deploy",
    },
    {
      title: "Total Withdraw",
      value: formatCurrency(kpis.totalWithdraw),
      icon: ArrowDownToLine,
      hint: "Moved off-platform",
    },
    {
      title: "Pending Withdraw",
      value: formatCurrency(kpis.pendingWithdraw),
      icon: Clock,
      hint: "In review",
    },
  ]

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card, index) => (
        <div
          key={card.title}
          className="relative overflow-hidden rounded-[28px] border border-white/30 bg-white/70 p-5 shadow-[0_25px_60px_rgba(87,65,217,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5"
        >
          <div className={`pointer-events-none absolute inset-0 rounded-[28px] bg-gradient-to-br ${gradients[index % gradients.length]}`} aria-hidden />
          <div className="relative space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">{card.title}</p>
                <p className="mt-2 text-3xl font-bold text-foreground dark:text-white">{card.value}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/40 bg-white/70 text-foreground shadow-lg dark:border-white/10 dark:bg-white/5 dark:text-white">
                <card.icon className="h-5 w-5" aria-hidden />
              </div>
            </div>
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">{card.hint}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
