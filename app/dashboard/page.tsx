"use client"

import { useEffect, useState } from "react"
import { KPICards } from "@/components/dashboard/kpi-cards"
import { MiningWidget } from "@/components/dashboard/mining-widget"
import { HalvingChart } from "@/components/dashboard/halving-chart"
import { Sidebar } from "@/components/layout/sidebar"
import { Loader2, Users, Wallet } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface DashboardData {
  kpis: {
    totalEarning: number
    totalBalance: number
    currentBalance: number
    activeMembers: number
    totalWithdraw: number
    pendingWithdraw: number
    teamReward: number
  }
  mining: {
    canMine: boolean
    nextEligibleAt: string
    earnedInCycle: number
  }
  user: {
    level: number
    referralCode: string
    roiEarnedTotal: number
    depositTotal: number
  }
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchDashboardData = async () => {
    try {
      const [dashboardRes, userRes] = await Promise.all([fetch("/api/dashboard"), fetch("/api/auth/me")])

      if (dashboardRes.ok && userRes.ok) {
        const dashboardData = await dashboardRes.json()
        const userData = await userRes.json()
        setData(dashboardData)
        setUser(userData.user)
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading your mining dashboard...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="text-foreground font-medium">Failed to load dashboard data</p>
          <p className="text-muted-foreground">Please refresh the page or try again later</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user} />

      <main className="flex-1 md:ml-64 overflow-auto">
        <div className="p-6 space-y-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold crypto-gradient-text">Mining Dashboard</h1>
            <p className="text-muted-foreground text-lg">
              Welcome back, <span className="font-semibold text-foreground">{user?.name}</span> • Level{" "}
              {data.user.level} Miner
            </p>
          </div>

          <KPICards kpis={data.kpis} />

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <MiningWidget mining={data.mining} onMiningSuccess={fetchDashboardData} />
            <HalvingChart />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="crypto-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">ROI Progress</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    ${data.user.roiEarnedTotal.toFixed(2)} / ${(data.user.depositTotal * 3).toFixed(2)}
                  </div>
                  <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-primary to-accent h-3 rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${Math.min((data.user.roiEarnedTotal / (data.user.depositTotal * 3)) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">3x ROI Cap Target</p>
                </div>
              </CardContent>
            </Card>

            <Card className="crypto-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Referral Code</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-mono font-bold text-primary">{data.user.referralCode}</div>
                <p className="text-xs text-muted-foreground mt-1">Share to earn commissions</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
