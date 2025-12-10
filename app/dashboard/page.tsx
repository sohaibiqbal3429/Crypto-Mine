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
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.1),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(6,182,212,0.12),transparent_40%)]" />
      </div>

      <ImportantUpdateModal />
      <main className="main-content relative min-w-0">
        <div className="grid-overlay relative mx-auto flex max-w-7xl flex-col gap-8 px-4 pb-12 pt-6 md:px-8">
          <div className="flex flex-col gap-2">
            <p className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-100">
              5gbotify overview
            </p>
            <h1 className="text-3xl font-semibold">Hi, {user?.name} 👋</h1>
            <p className="text-sm text-slate-400">Role: Network Harvester – Tier {data.user.level}</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[2fr,1fr] lg:items-center">
            <KPICards kpis={data.kpis} />
            <div className="rounded-2xl border border-slate-800/70 bg-slate-900/70 p-5 shadow-lg shadow-emerald-500/10">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">Ops status</p>
                  <p className="text-sm text-slate-300">Backend parity with MintMine Pro, new skin for 5gbotify.</p>
                </div>
                <span className="rounded-md bg-emerald-500/20 px-3 py-1 text-[11px] font-semibold uppercase text-emerald-100">synced</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Link
                  href="/mining"
                  className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-left text-sm font-semibold text-emerald-100 transition hover:-translate-y-[1px] hover:border-emerald-400/70"
                >
                  Launch Mining Hub
                  <span className="block text-xs font-normal text-emerald-50/80">Jump to engine controls</span>
                </Link>
                <Link
                  href="/wallet/deposit"
                  className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-left text-sm font-semibold text-cyan-100 transition hover:-translate-y-[1px] hover:border-cyan-400/60"
                >
                  Add funds in Top-Up Center
                  <span className="block text-xs font-normal text-cyan-50/80">Same flow, sharper look</span>
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[2fr,1.25fr]">
            <MiningWidget mining={data.mining} onMiningSuccess={fetchDashboardData} />
            <div className="grid gap-6">
              <HalvingChart />
              <RateLimitTelemetryCard />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <LuckyDrawCard currentUser={user} />
            </div>
            <InviteAndEarnPanel referralCode={data.user.referralCode} />
          </div>
        </div>
      </main>
    </div>
  )
}
