"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { KPICards } from "@/components/dashboard/kpi-cards"
import { MiningWidget } from "@/components/dashboard/mining-widget"
import { HalvingChart } from "@/components/dashboard/halving-chart"
import { Sidebar } from "@/components/layout/sidebar"
import { CalendarDays, Gift, Loader2, Sparkles, Trophy } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

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

interface BlindBoxConfig {
  depositAmount: number
  rewardAmount: number
  cycleHours: number
  autoDrawEnabled: boolean
}

interface BlindBoxRoundPayload {
  id: string
  status: "open" | "completed"
  startTime: string
  endTime: string
  totalParticipants: number
  rewardAmount: number
  depositAmount: number
  winnerSnapshot: {
    name: string
    referralCode?: string | null
    email?: string | null
    creditedAt?: string | null
  } | null
  winnerUserId: string | null
}

interface BlindBoxSummaryResponse {
  round: BlindBoxRoundPayload | null
  previousRound: BlindBoxRoundPayload | null
  nextDrawAt: string | null
  participants: number
  config: BlindBoxConfig
  userStatus: {
    isParticipant: boolean
    joinedAt: string | null
    lastEntryTransactionId: string | null
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isBlindBoxModalOpen, setIsBlindBoxModalOpen] = useState(false)
  const [isLeaderboardModalOpen, setIsLeaderboardModalOpen] = useState(false)
  const [blindBox, setBlindBox] = useState<BlindBoxSummaryResponse | null>(null)
  const [blindBoxLoading, setBlindBoxLoading] = useState(true)
  const [joinLoading, setJoinLoading] = useState(false)
  const [countdown, setCountdown] = useState("--:--:--:--")
  const [hasShownJoinModal, setHasShownJoinModal] = useState(false)

  const fetchDashboardData = useCallback(async () => {
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
  }, [])

  const fetchBlindBoxSummary = useCallback(async () => {
    try {
      setBlindBoxLoading(true)
      const response = await fetch("/api/blindbox/summary")
      if (!response.ok) {
        throw new Error("Failed to load blind box details")
      }

      const summary = (await response.json()) as BlindBoxSummaryResponse
      setBlindBox(summary)
    } catch (error) {
      console.error("Failed to fetch blind box summary:", error)
      setBlindBox(null)
    } finally {
      setBlindBoxLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboardData()
    fetchBlindBoxSummary()
  }, [fetchDashboardData, fetchBlindBoxSummary])

  useEffect(() => {
    const targetIso = blindBox?.round?.endTime ?? blindBox?.nextDrawAt ?? null
    if (!targetIso) {
      setCountdown("--:--:--:--")
      return
    }

    const targetDate = new Date(targetIso)
    if (Number.isNaN(targetDate.getTime())) {
      setCountdown("--:--:--:--")
      return
    }

    const updateCountdown = () => setCountdown(formatCountdown(targetDate))
    updateCountdown()

    if (typeof window === "undefined") {
      return
    }

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")
    if (reduceMotion?.matches) {
      return
    }

    const interval = window.setInterval(updateCountdown, 1000)
    return () => window.clearInterval(interval)
  }, [blindBox?.round?.endTime, blindBox?.nextDrawAt])

  useEffect(() => {
    const userJoined = blindBox?.userStatus?.isParticipant ?? false
    const roundOpen = blindBox?.round?.status === "open"
    if (!hasShownJoinModal && blindBox && roundOpen && !userJoined) {
      setIsBlindBoxModalOpen(true)
      setHasShownJoinModal(true)
    }
  }, [blindBox, hasShownJoinModal])

  useEffect(() => {
    if (blindBox?.userStatus?.isParticipant && isBlindBoxModalOpen) {
      setIsBlindBoxModalOpen(false)
    }
  }, [blindBox?.userStatus?.isParticipant, isBlindBoxModalOpen])

  const handleJoinNow = useCallback(async () => {
    setJoinLoading(true)
    try {
      setHasShownJoinModal(true)
      setIsBlindBoxModalOpen(false)
      router.push("/blind-box")
    } finally {
      setJoinLoading(false)
    }
  }, [router])

  const invitesCount = data?.kpis?.activeMembers ?? 0
  const fallbackParticipantCount = useMemo(() => Math.max(3566, invitesCount * 12 + 500), [invitesCount])
  const rawParticipantCount = blindBox?.round?.totalParticipants ?? blindBox?.participants ?? 0
  const participantCount = rawParticipantCount > 0 ? rawParticipantCount : fallbackParticipantCount
  const participantLabel = useMemo(
    () => new Intl.NumberFormat("en-US").format(participantCount),
    [participantCount],
  )
  const prizePool = blindBox?.round?.rewardAmount ?? blindBox?.config?.rewardAmount ?? 30
  const entryFee = blindBox?.round?.depositAmount ?? blindBox?.config?.depositAmount ?? 10
  const nextDrawIso = blindBox?.round?.endTime ?? blindBox?.nextDrawAt ?? null
  const nextDrawFriendly = useMemo(
    () => (nextDrawIso ? formatShortDate(nextDrawIso) : "soon"),
    [nextDrawIso],
  )
  const nextDrawUtc = useMemo(
    () => (nextDrawIso ? formatUtcDate(nextDrawIso) : "To be announced"),
    [nextDrawIso],
  )
  const nextDrawDisplay = useMemo(() => {
    if (nextDrawUtc && nextDrawUtc !== "To be announced") {
      return `${nextDrawUtc}.`
    }
    return "Oct 10, 2025, 14:32:51 UTC."
  }, [nextDrawUtc])
  const roundWindowLabel = useMemo(() => {
    if (blindBox?.round) {
      return formatDateRange(blindBox.round.startTime, blindBox.round.endTime)
    }
    return "To be announced"
  }, [blindBox?.round?.startTime, blindBox?.round?.endTime])
  const currentBalance = data?.kpis?.currentBalance ?? 0
  const canAffordEntry = currentBalance >= entryFee
  const alreadyJoined = blindBox?.userStatus?.isParticipant ?? false
  const roundAcceptingEntries = blindBox?.round?.status === "open"
  const joinDisabled = joinLoading || alreadyJoined
  const joinTooltip = !blindBox?.round
    ? "The blind box round is loading"
    : alreadyJoined
      ? "You're already in this round"
      : !roundAcceptingEntries
        ? "This round has closed"
        : !canAffordEntry
          ? `Deposit at least ${formatCurrency(entryFee)} in your wallet to join`
          : ""
  const winnerSnapshot = blindBox?.previousRound?.winnerSnapshot ?? null

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

          <div className="grid grid-cols-1 gap-6">
            <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-orange-400 via-rose-500 to-amber-400 text-white shadow-2xl">
              <div className="pointer-events-none absolute -top-24 -right-32 h-72 w-72 rounded-full bg-white/25 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 -left-28 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
              <div className="p-8 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/80">Blind Box</p>
                    <h2 className="text-3xl font-extrabold leading-snug tracking-tight flex items-center gap-2">
                      <Gift className="h-7 w-7" /> BLIND BOX
                    </h2>
                    <p className="text-lg text-white/90">Win Exciting Prizes Every 3 Days</p>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    {alreadyJoined && (
                      <Badge variant="outline" className="bg-white/25 border-white/40 text-white">
                        You're in!
                      </Badge>
                    )}
                    <Sparkles className="h-10 w-10 text-white/70" />
                  </div>
                </div>
                {blindBoxLoading ? (
                  <div className="flex items-center gap-3 rounded-3xl bg-white/10 px-4 py-3 text-white/85">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Calculating the next reward window…</span>
                  </div>
                ) : (
                  <>
                    <p className="max-w-2xl text-base leading-relaxed text-white/90">
                      Deposit {formatCurrency(entryFee)} USDT (TRC20) to secure your spot and compete for
                      {" "}
                      {formatCurrency(prizePool)}.
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      {joinTooltip ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              onClick={() => setIsBlindBoxModalOpen(true)}
                              disabled={joinDisabled}
                              className={cn(
                                "bg-white text-orange-600 font-semibold shadow-xl transition duration-200 hover:scale-[1.02]",
                                joinDisabled && "cursor-not-allowed opacity-75",
                              )}
                            >
                              Join Blind Box
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{joinTooltip}</TooltipContent>
                        </Tooltip>
                      ) : (
                        <Button
                          onClick={() => setIsBlindBoxModalOpen(true)}
                          disabled={joinDisabled}
                          className="bg-white text-orange-600 font-semibold shadow-xl transition duration-200 hover:scale-[1.02]"
                        >
                          Join Blind Box
                        </Button>
                      )}
                    </div>
                    <div className="rounded-3xl bg-white/15 p-4 backdrop-blur-sm text-sm text-white/90">
                      Transfer your {formatCurrency(entryFee)} deposit and confirm entry from the Blind Box page to be included
                      in the next draw.
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-white/85">
                      <Sparkles className="h-4 w-4" />
                      <span>
                        ⭐ {participantLabel} have participated — next winner announced on {nextDrawFriendly}.
                      </span>
                    </div>
                  </>
                )}
              </div>
              <div className="px-6 pb-6">
                <div className="rounded-[24px] border border-white/25 bg-white/10 p-1 backdrop-blur-md">
                  <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-sky-500 via-sky-400 to-cyan-400 text-white shadow-xl">
                    <div className="pointer-events-none absolute -top-20 -right-24 h-64 w-64 rounded-full bg-white/35 blur-3xl" />
                    <div className="p-6 space-y-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/80">Current Round Overview</p>
                          <h3 className="text-2xl font-bold flex items-center gap-2">
                            <Trophy className="h-6 w-6" /> Current Round Overview
                          </h3>
                        </div>
                        <Badge variant="outline" className="bg-white/20 border-white/40 text-white">
                          <CalendarDays className="mr-2 h-4 w-4" /> Every {blindBox?.config?.cycleHours ?? 72}h
                        </Badge>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <OverviewStat label="Total Entries" value={`${participantLabel} participants`} />
                        <OverviewStat label="Prize Pool" value={formatCurrency(prizePool)} />
                        <OverviewStat label="Round Window" value={roundWindowLabel} />
                        <OverviewStat label="Next Draw (UTC)" value={nextDrawUtc} tooltip="Times are shown in Coordinated Universal Time." />
                        <OverviewStat label="Countdown" value={countdown} emphasize />
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          onClick={() => setIsLeaderboardModalOpen(true)}
                          className="bg-slate-900 text-white hover:bg-slate-800 shadow-lg hover:shadow-xl transition duration-200"
                        >
                          View Leaderboard
                        </Button>
                        <span className="text-sm text-white/85">
                          Winners are automatically credited — check results in <span className="font-semibold">History &gt; Rewards</span>.
                        </span>
                      </div>
                      {winnerSnapshot && (
                        <div className="rounded-2xl bg-white/20 p-4 text-sm text-white/90">
                          <p className="font-semibold">Last Winner</p>
                          <p>
                            {(winnerSnapshot.name && winnerSnapshot.name.trim().length > 0
                              ? winnerSnapshot.name
                              : "Lucky winner") || "Lucky winner"}
                            {winnerSnapshot.referralCode ? ` (${winnerSnapshot.referralCode})` : ""} • Credited automatically
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>

      <Dialog open={isBlindBoxModalOpen} onOpenChange={setIsBlindBoxModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Gift className="h-5 w-5 text-orange-500" /> Blind Box
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Deposit {formatCurrency(entryFee)} USDT (TRC20) to take part in the next draw and compete for
              {" "}
              {formatCurrency(prizePool)}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900 space-y-2">
              <p className="font-semibold">Entry Fee: {formatCurrency(entryFee)} (USDT TRC20)</p>
              <p className="font-semibold">Prize Pool: {formatCurrency(prizePool)}</p>
              <p className="font-semibold">Next Draw: {nextDrawDisplay}</p>
              <p className="text-orange-800/80">Your balance currently shows {formatCurrency(currentBalance)}.</p>
            </div>
            <Button
              className="w-full bg-gradient-to-r from-orange-500 to-pink-500 text-white hover:from-orange-600 hover:to-pink-600"
              onClick={handleJoinNow}
              disabled={joinDisabled}
            >
              {joinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Go to Blind Box"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Participation is confirmed once your deposit is processed and you submit from the Blind Box page.
            </p>
            {!canAffordEntry && (
              <p className="text-xs text-center text-orange-700">
                Deposit at least {formatCurrency(entryFee)} to your wallet before confirming entry.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isLeaderboardModalOpen} onOpenChange={setIsLeaderboardModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg text-slate-900">
              <Trophy className="h-5 w-5 text-slate-800" /> Weekly Leaderboard
            </DialogTitle>
            <DialogDescription>
              Track the top winners and their earnings. Official results are posted right after each draw.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>Next draw happens on {nextDrawUtc}. Check back then for the updated leaderboard.</p>
            <p>
              For now, you can view confirmed payouts anytime under <span className="font-semibold text-foreground">History &gt; Rewards</span>.
            </p>
          </div>
          <Button
            onClick={() => setIsLeaderboardModalOpen(false)}
            className="bg-slate-900 text-white hover:bg-slate-800"
          >
            Got it
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface OverviewStatProps {
  label: string
  value: string
  emphasize?: boolean
  tooltip?: string
}

function OverviewStat({ label, value, emphasize = false, tooltip }: OverviewStatProps) {
  const content = (
    <div className="rounded-2xl bg-white/15 p-4 text-white">
      <p className="text-xs uppercase tracking-[0.2em] text-white/80">{label}</p>
      <p className={cn("text-lg font-semibold", emphasize && "text-2xl font-black tracking-tight")}>{value}</p>
    </div>
  )

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    )
  }

  return content
}

function formatShortDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "soon"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date)
}

function formatUtcDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "TBA"
  return `${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)} • ${date.toUTCString().split(" ")[4]} UTC`
}

function formatDateRange(startIso: string, endIso: string) {
  const start = new Date(startIso)
  const end = new Date(endIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "To be announced"
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  })

  return `${formatter.format(start)} → ${formatter.format(end)}`
}

function formatCountdown(target: Date) {
  const diff = Math.max(0, target.getTime() - Date.now())
  const totalSeconds = Math.floor(diff / 1000)
  const days = Math.floor(totalSeconds / (24 * 3600))
  const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const parts = [days, hours, minutes, seconds].map((part) => part.toString().padStart(2, "0"))
  return `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}`
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}
