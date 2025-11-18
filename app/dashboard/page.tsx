"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Trophy } from "lucide-react"

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
    name?: string
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchDashboardData = useCallback(async () => {
    try {
      const [dashboardRes, userRes] = await Promise.all([fetch("/api/dashboard"), fetch("/api/auth/me")])

      if (dashboardRes.status === 403) {
        router.replace("/auth/login?blocked=1")
        return
      }

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
  }, [router])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  const heroTiles = useMemo(() => {
    if (!data) return []
    return [
      {
        label: "Active teammates",
        value: data.kpis.activeMembers.toLocaleString(),
        hint: "building the minting hive",
      },
      {
        label: "ROI earned",
        value: `$${data.user.roiEarnedTotal.toFixed(2)}`,
        hint: "lifetime yield",
      },
      {
        label: "Total deposits",
        value: `$${data.user.depositTotal.toFixed(2)}`,
        hint: "fueling your rig",
      },
    ]
  }, [data])

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
          <p className="text-muted-foreground">Please refresh the page or try again later</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_hsla(250,80%,85%,0.35),_transparent_55%)] pb-28">
      <ImportantUpdateModal />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
        <div className="absolute right-1/4 top-10 h-72 w-72 rounded-full bg-gradient-to-br from-purple-500/40 to-cyan-400/20 blur-3xl" />
        <div className="absolute bottom-0 left-10 h-72 w-72 rounded-full bg-gradient-to-br from-emerald-400/20 to-indigo-500/30 blur-3xl" />
      </div>

      <main className="relative mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-24 pt-6 sm:px-6 lg:px-8">
        <section className="grid gap-6 xl:grid-cols-[2fr,1fr]">
          <div className="relative overflow-hidden rounded-[32px] border border-white/30 bg-white/70 p-6 text-foreground shadow-[0_30px_60px_rgba(89,70,231,0.15)] backdrop-blur-xl dark:border-white/10 dark:bg-white/10 dark:text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.35),_transparent_55%)]" aria-hidden />
            <div className="relative space-y-4">
              <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Welcome back</p>
              <h1 className="text-3xl font-semibold leading-tight text-foreground dark:text-white">
                {user?.name ?? "Explorer"}, your Aurora vault is humming.
              </h1>
              <p className="text-base text-muted-foreground">
                Level {data.user.level} miner · Referral code {data.user.referralCode}
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {heroTiles.map((tile) => (
                  <div key={tile.label} className="rounded-2xl border border-white/50 bg-white/60 p-4 shadow-inner dark:border-white/10 dark:bg-white/5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tile.label}</p>
                    <p className="mt-2 text-2xl font-bold text-foreground dark:text-white">{tile.value}</p>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{tile.hint}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[32px] border border-white/30 bg-gradient-to-br from-indigo-600 via-purple-600 to-cyan-500 p-6 text-white shadow-[0_25px_50px_rgba(79,70,229,0.45)]">
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-white/70">Team momentum</p>
                <p className="mt-3 text-4xl font-bold">${data.kpis.teamReward.toFixed(2)}</p>
                <p className="text-sm text-white/80">Lifetime team rewards</p>
              </div>
              <div className="rounded-2xl border border-white/30 bg-white/10 p-4 text-white/90">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>Today&apos;s boost</span>
                  <span className="text-white">
                    ${data.kpis.teamRewardToday?.toFixed(2) ?? "0.00"}
                  </span>
                </div>
                <p className="mt-2 text-xs uppercase tracking-[0.3em] text-white/70">Keep inviting to amplify rewards</p>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/30 bg-white/5 px-4 py-3 text-sm uppercase tracking-[0.2em]">
                <Trophy className="h-5 w-5" aria-hidden />
                <span>
                  XP vault ready • next milestone at {Math.ceil(data.kpis.totalEarning).toLocaleString()} USDT
                </span>
              </div>
            </div>
          </div>
        </section>

        <KPICards kpis={data.kpis} />

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <MiningWidget mining={data.mining} onMiningSuccess={fetchDashboardData} />
          </div>
          <HalvingChart />
        </div>

        <RateLimitTelemetryCard />

        <div className="grid gap-6 xl:grid-cols-[2fr,1fr]">
          <LuckyDrawCard currentUser={user} />
          <InviteAndEarnPanel referralCode={data.user.referralCode} />
        </div>
      </main>
    </div>
  )
}
