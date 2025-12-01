"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { ImportantUpdateModal } from "@/components/dashboard/important-update-modal"
import { KPICards } from "@/components/dashboard/kpi-cards"
import { MiningWidget } from "@/components/dashboard/mining-widget"
import { RateLimitTelemetryCard } from "@/components/dashboard/rate-limit-telemetry"
import { HalvingChart } from "@/components/dashboard/halving-chart"
import { LuckyDrawCard } from "@/components/dashboard/lucky-draw-card"
import { InviteAndEarnPanel } from "@/components/dashboard/invite-and-earn-panel"
import { Sidebar } from "@/components/layout/sidebar"

interface DashboardData {
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
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fetchDashboardData = useCallback(async () => {
    const parseResponse = async (response: Response) => {
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""

      if (contentType.includes("application/json")) {
        const json = await response.json().catch(() => null)
        return { json, rawText: "" }
      }

      const rawText = (await response.text().catch(() => "")) || ""
      return { json: null, rawText }
    }

    try {
      const [dashboardRes, userRes] = await Promise.all([
        fetch("/api/dashboard", { credentials: "include" }),
        fetch("/api/auth/me", { credentials: "include" }),
      ])

      const [dashboardPayload, userPayload] = await Promise.all([
        parseResponse(dashboardRes),
        parseResponse(userRes),
      ])

      if (dashboardRes.status === 401 || userRes.status === 401) {
        router.replace("/auth/login")
        return
      }

      if (dashboardRes.status === 403) {
        router.replace("/auth/login?blocked=1")
        return
      }

      if (dashboardRes.ok && userRes.ok && dashboardPayload.json && userPayload.json) {
        setData(dashboardPayload.json as DashboardData)
        setUser((userPayload.json as any).user)
        setErrorMessage(null)
        return
      }

      const dashError =
        (dashboardPayload.json && typeof dashboardPayload.json === "object" &&
          (dashboardPayload.json as any).error) ||
        dashboardPayload.rawText
      const friendlyMessage = typeof dashError === "string" && dashError.trim() ? dashError.trim() : null

      setErrorMessage(friendlyMessage ?? "Failed to load dashboard data")
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error)
      setErrorMessage("Failed to load dashboard data")
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading your mining dashboard...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="font-medium text-foreground">Failed to load dashboard data</p>
          <p className="text-muted-foreground">
            {errorMessage || "Please refresh the page or try again later"}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* ✅ Dono modals yahan render ho rahe hain */}
      <ImportantUpdateModal />

      <Sidebar user={user} />

      <main className="main-content flex-1 min-w-0">
        <div className="space-y-8 p-6">
          <div className="space-y-2">
            <h1 className="crypto-gradient-text text-4xl font-bold">Mining Dashboard</h1>
            <p className="text-lg text-muted-foreground">
              Welcome back, <span className="font-semibold text-foreground">{user?.name}</span> • Level {data.user.level} Miner
            </p>
          </div>

          <KPICards kpis={data.kpis} />

          <div className="dashboard-grid">
            <MiningWidget mining={data.mining} onMiningSuccess={fetchDashboardData} />
            <HalvingChart />
            <RateLimitTelemetryCard />
          </div>

          <div className="dashboard-grid">
            <div className="dashboard-card xl:col-span-2">
              <LuckyDrawCard currentUser={user} />
            </div>
            <InviteAndEarnPanel referralCode={data.user.referralCode} />
          </div>
        </div>
      </main>
    </div>
  )
}
