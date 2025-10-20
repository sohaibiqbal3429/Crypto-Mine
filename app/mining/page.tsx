import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { verifyToken } from "@/lib/auth"
import { fetchWalletContext } from "@/lib/services/wallet"
import { getMiningStatus } from "@/lib/services/mining"
import { multiplyAmountByPercent } from "@/lib/utils/numeric"
import { Sidebar } from "@/components/layout/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MiningWidget } from "@/components/dashboard/mining-widget"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Zap, Clock, Award } from "lucide-react"

export default async function MiningPage() {
  // cookies() is synchronous in the app router context
  const cookieStore = cookies()
  const token = cookieStore.get("auth-token")?.value
  if (!token) {
    redirect("/auth/login")
  }

  // verifyToken returns a promise; await to validate the session
  const session = await verifyToken(token)
  if (!session) {
    redirect("/auth/login")
  }

  const [walletContext, miningStatus] = await Promise.all([
    fetchWalletContext(session.userId),
    getMiningStatus(session.userId),
  ])

  if (!walletContext) {
    redirect("/auth/login")
  }

  const overviewStats = {
    totalClicks: miningStatus.totalClicks,
    todayMined: miningStatus.earnedInCycle,
    efficiency: Math.min(Math.round(miningStatus.userStats.roiProgress), 100),
    rank: 0,
    totalMiners: 0,
  }

  const dailyProfitPercent = miningStatus.miningSettings.dailyProfitPercent
  const dailyProfitPreview = multiplyAmountByPercent(100, dailyProfitPercent)

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={walletContext.user} />

      <main className="flex-1 md:ml-64 overflow-auto">
        <div className="p-6 space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-balance">Mint-Coin Mining</h1>
            <p className="text-muted-foreground">
              Mine rewards daily and track your performance.
            </p>
          </div>

          <MiningWidget mining={miningStatus} />

          {/* ---- Cards ---- */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Mined</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overviewStats.totalClicks}</div>
                <p className="text-xs text-muted-foreground">Mining actions performed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today&apos;s Mining</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${overviewStats.todayMined.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Original</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">ROI Progress</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overviewStats.efficiency}%</div>
                <p className="text-xs text-muted-foreground">Lowest</p>
              </CardContent>
            </Card>
          </section>

          {/* ---- Efficiency ---- */}
          <Card>
            <CardHeader>
              <CardTitle>Mining Efficiency</CardTitle>
              <CardDescription>Your current mining performance metrics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">ROI Progress</span>
                  <Badge
                    variant={
                      overviewStats.efficiency >= 90
                        ? "default"
                        : overviewStats.efficiency >= 70
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    {overviewStats.efficiency}%
                  </Badge>
                </div>
                <Progress value={overviewStats.efficiency} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {overviewStats.efficiency >= 90
                    ? "Earning cap approaching. Consider preparing for reinvestment."
                    : overviewStats.efficiency >= 70
                    ? "Solid progress. Keep mining daily."
                    : "Grow your deposit or team to boost returns."}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="font-semibold text-lg">
                    {miningStatus.requiresDeposit ? "--" : "24h"}
                  </div>
                  <div className="text-muted-foreground">Mining Uptime</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="font-semibold text-lg">{dailyProfitPercent.toFixed(2)}%</div>
                  <div className="text-muted-foreground">Daily profit • $100 → ${dailyProfitPreview.toFixed(2)}</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="font-semibold text-lg">
                    ${walletContext.stats.currentBalance.toFixed(2)}
                  </div>
                  <div className="text-muted-foreground">Available balance</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

