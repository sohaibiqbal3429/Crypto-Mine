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
  }
}

export function KPICards({ kpis }: KPICardsProps) {
  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`

  const cards = [
    {
      title: "Total Earning",
      value: formatCurrency(kpis.totalEarning),
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Total Balance",
      value: formatCurrency(kpis.totalBalance),
      icon: Wallet,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Current Balance",
      value: formatCurrency(kpis.currentBalance),
      icon: DollarSign,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
    {
      title: "Total Withdraw",
      value: formatCurrency(kpis.totalWithdraw),
      icon: ArrowDownToLine,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "Pending Withdraw",
      value: formatCurrency(kpis.pendingWithdraw),
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      title: "Daily Team Reward",
      value: formatCurrency(kpis.teamReward),
      icon: Trophy,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
      {cards.map((card, index) => (
        <Card key={index} className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
            <div className={`p-2 rounded-lg ${card.bgColor}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
