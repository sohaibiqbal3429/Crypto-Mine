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
    <div className="min-h-screen bg-background">
      <ImportantUpdateModal />

      <main className="mx-auto min-w-0 max-w-6xl px-4 pb-12 pt-6 lg:px-6">
        <div className="flex flex-col gap-2 border-b border-border/60 pb-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Hi, {user?.name} 👋</p>
          <h1 className="text-3xl font-bold text-foreground">Overview Control</h1>
          <p className="text-sm text-muted-foreground">Network Harvester – Tier {data.user.level}</p>
        </div>

        <div className="mt-6 space-y-8">
          <KPICards kpis={data.kpis} />

          <div className="grid gap-6 lg:grid-cols-3">
            <MiningWidget mining={data.mining} onMiningSuccess={fetchDashboardData} />
            <div className="space-y-4 rounded-xl border border-border/70 bg-card/70 p-4 shadow-[0_18px_38px_-26px_rgba(0,0,0,0.7)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Quick actions</p>
                  <p className="text-sm text-foreground">Boost, fund, or notify your crew.</p>
                </div>
                <span className="rounded-md bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Live</span>
              </div>
              <div className="space-y-3">
                {["Boost performance", "Add funds to vault", "Invite crew member"].map((action) => (
                  <div
                    key={action}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/60 px-3 py-2 text-sm text-foreground"
                  >
                    <span>{action}</span>
                    <button className="text-xs font-semibold text-primary hover:underline">Launch</button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <HalvingChart />
            <RateLimitTelemetryCard />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-xl border border-border/70 bg-card/70 p-4 shadow-[0_18px_38px_-26px_rgba(0,0,0,0.7)] xl:col-span-2">
              <LuckyDrawCard currentUser={user} />
            </div>
            <InviteAndEarnPanel referralCode={data.user.referralCode} />
          </div>
        </div>
      </main>
    </div>
  )
}
