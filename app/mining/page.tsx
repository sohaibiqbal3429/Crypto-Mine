"use client"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MiningWidget } from "@/components/dashboard/mining-widget"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Zap, Clock, TrendingUp, Award, Loader2 } from "lucide-react"

interface MiningStats {
  totalMined: number
  todayMined: number
  miningPower: number
  efficiency: number
  rank: number
  totalMiners: number
}

export default function MiningPage() {
  const [user, setUser] = useState<any>(null)
  const [miningData, setMiningData] = useState<any>(null)
  const [stats, setStats] = useState<MiningStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      const [userRes, dashboardRes] = await Promise.all([fetch("/api/auth/me"), fetch("/api/dashboard")])

      if (userRes.ok && dashboardRes.ok) {
        const userData = await userRes.json()
        const dashboardData = await dashboardRes.json()
        setUser(userData.user)
        setMiningData(dashboardData.mining)

        // Mock mining stats - in real app, this would come from API
        setStats({
          totalMined: 245.67,
          todayMined: 12.34,
          miningPower: 850,
          efficiency: 92,
          rank: 156,
          totalMiners: 5420,
        })
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user} />

      <main className="flex-1 md:ml-64 overflow-auto">
        <div className="p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-balance">P-Coin Mining</h1>
            <p className="text-muted-foreground">Mine P-Coins and track your progress</p>
          </div>

          {/* Mining Widget */}
          {miningData && (
            <div className="mb-8">
              <MiningWidget mining={miningData} onMiningSuccess={fetchData} />
            </div>
          )}

          {/* Mining Stats */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Mined</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalMined.toFixed(2)} PCN</div>
                  <p className="text-xs text-muted-foreground">All time earnings</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Today's Mining</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.todayMined.toFixed(2)} PCN</div>
                  <p className="text-xs text-muted-foreground">Last 24 hours</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Mining Power</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.miningPower} MH/s</div>
                  <p className="text-xs text-muted-foreground">Current hash rate</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Global Rank</CardTitle>
                  <Award className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">#{stats.rank}</div>
                  <p className="text-xs text-muted-foreground">of {stats.totalMiners.toLocaleString()} miners</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Mining Efficiency */}
          {stats && (
            <Card>
              <CardHeader>
                <CardTitle>Mining Efficiency</CardTitle>
                <CardDescription>Your current mining performance metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Efficiency Rate</span>
                    <Badge
                      variant={
                        stats.efficiency >= 90 ? "default" : stats.efficiency >= 70 ? "secondary" : "destructive"
                      }
                    >
                      {stats.efficiency}%
                    </Badge>
                  </div>
                  <Progress value={stats.efficiency} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {stats.efficiency >= 90
                      ? "Excellent performance!"
                      : stats.efficiency >= 70
                        ? "Good performance"
                        : "Consider upgrading your mining setup"}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="font-semibold text-lg">24h</div>
                    <div className="text-muted-foreground">Mining Uptime</div>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="font-semibold text-lg">0.05%</div>
                    <div className="text-muted-foreground">Network Share</div>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="font-semibold text-lg">$2.45</div>
                    <div className="text-muted-foreground">Est. Daily Profit</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
