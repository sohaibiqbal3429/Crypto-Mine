"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { KPICards } from "@/components/dashboard/kpi-cards"
import { MiningWidget } from "@/components/dashboard/mining-widget"
import { HalvingChart } from "@/components/dashboard/halving-chart"
import { Sidebar } from "@/components/layout/sidebar"
import {
  CalendarDays,
  Copy,
  Gift,
  Loader2,
  Share2,
  Sparkles,
  Trophy,
  Users as UsersIcon,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/components/ui/use-toast"
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

interface LuckyDrawConfig {
  entryFee: number
  prize: number
  cycleHours: number
  autoDrawEnabled: boolean
}

interface LuckyDrawRoundPayload {
  id: string
  status: "open" | "closed" | "completed"
  entryFee: number
  prize: number
  startsAt: string
  endsAt: string
  totalEntries: number
  hasJoined: boolean
}

interface LuckyDrawPreviousRoundPayload {
  id: string
  status: "open" | "closed" | "completed"
  prize: number
  totalEntries: number
  winnerSnapshot: {
    userId: string
    name: string
    referralCode: string
    email?: string | null
    creditedAt: string | null
  } | null
  endsAt: string
  completedAt: string
}

interface LuckyDrawSummaryResponse {
  round: LuckyDrawRoundPayload | null
  config: LuckyDrawConfig
  nextDrawAt: string | null
  previousRound: LuckyDrawPreviousRoundPayload | null
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [isBlindBoxModalOpen, setIsBlindBoxModalOpen] = useState(false)
  const [isLeaderboardModalOpen, setIsLeaderboardModalOpen] = useState(false)
  const [copyMessage, setCopyMessage] = useState<string | null>(null)
  const [referralLink, setReferralLink] = useState("")
  const [luckyDraw, setLuckyDraw] = useState<LuckyDrawSummaryResponse | null>(null)
  const [luckyDrawLoading, setLuckyDrawLoading] = useState(true)
  const [joinLoading, setJoinLoading] = useState(false)
  const [countdown, setCountdown] = useState("--:--:--:--")
  const { toast } = useToast()

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

  const fetchLuckyDrawSummary = useCallback(async () => {
    try {
      setLuckyDrawLoading(true)
      const response = await fetch("/api/lucky-draw/round/current")
      if (!response.ok) {
        throw new Error("Failed to load lucky draw details")
      }

      const summary = (await response.json()) as LuckyDrawSummaryResponse
      setLuckyDraw(summary)
    } catch (error) {
      console.error("Failed to fetch lucky draw summary:", error)
      setLuckyDraw(null)
    } finally {
      setLuckyDrawLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboardData()
    fetchLuckyDrawSummary()
  }, [fetchDashboardData, fetchLuckyDrawSummary])

  useEffect(() => {
    if (data?.user?.referralCode && typeof window !== "undefined") {
      const url = new URL("/auth/register", window.location.origin)
      url.searchParams.set("ref", data.user.referralCode)
      setReferralLink(url.toString())
    } else {
      setReferralLink("")
    }
  }, [data?.user?.referralCode])

  useEffect(() => {
    const targetIso = luckyDraw?.round?.endsAt ?? luckyDraw?.nextDrawAt ?? null
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
  }, [luckyDraw?.round?.endsAt, luckyDraw?.nextDrawAt])

  const handleCopy = useCallback(async (value: string, successMessage: string) => {
    if (!value) return

    try {
      await navigator.clipboard.writeText(value)
      setCopyMessage(successMessage)
    } catch (error) {
      console.error("Failed to copy value:", error)
      setCopyMessage("Unable to copy. Please try again.")
    }

    setTimeout(() => setCopyMessage(null), 3000)
  }, [])

  const handleConfirmJoin = useCallback(async () => {
    if (!luckyDraw?.round) return

    try {
      setJoinLoading(true)
      const response = await fetch("/api/lucky-draw/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundId: luckyDraw.round.id }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Unable to join the lucky draw")
      }

      toast({
        title: "You're in the draw!",
        description: "Good luck — we'll announce the winner soon.",
      })

      await Promise.all([fetchLuckyDrawSummary(), fetchDashboardData()])
      setIsBlindBoxModalOpen(false)
    } catch (error: any) {
      toast({
        title: "Unable to join",
        description: error?.message || "Please try again in a moment.",
        variant: "destructive",
      })
    } finally {
      setJoinLoading(false)
    }
  }, [fetchDashboardData, fetchLuckyDrawSummary, luckyDraw?.round, toast])

  const referralCode = data?.user?.referralCode ?? ""
  const invitesCount = data?.kpis?.activeMembers ?? 0
  const referralEarnings = data?.kpis?.teamReward ?? 0
  const formattedReferralEarnings = useMemo(() => formatCurrency(referralEarnings), [referralEarnings])
  const fallbackParticipantCount = useMemo(() => Math.max(3566, invitesCount * 12 + 500), [invitesCount])
  const rawParticipantCount = luckyDraw?.round?.totalEntries ?? 0
  const participantCount = rawParticipantCount > 0 ? rawParticipantCount : fallbackParticipantCount
  const participantLabel = useMemo(
    () => new Intl.NumberFormat("en-US").format(participantCount),
    [participantCount],
  )
  const referralStatsText = `${invitesCount} active invites | ${formattedReferralEarnings} earned from referrals`
  const prizePool = luckyDraw?.round?.prize ?? luckyDraw?.config?.prize ?? 30
  const entryFee = luckyDraw?.round?.entryFee ?? luckyDraw?.config?.entryFee ?? 10
  const nextDrawIso = luckyDraw?.round?.endsAt ?? luckyDraw?.nextDrawAt ?? null
  const nextDrawFriendly = useMemo(
    () => (nextDrawIso ? formatShortDate(nextDrawIso) : "soon"),
    [nextDrawIso],
  )
  const nextDrawUtc = useMemo(
    () => (nextDrawIso ? formatUtcDate(nextDrawIso) : "To be announced"),
    [nextDrawIso],
  )
  const roundWindowLabel = useMemo(() => {
    if (luckyDraw?.round) {
      return formatDateRange(luckyDraw.round.startsAt, luckyDraw.round.endsAt)
    }
    return "To be announced"
  }, [luckyDraw?.round?.startsAt, luckyDraw?.round?.endsAt])
  const currentBalance = data?.kpis?.currentBalance ?? 0
  const canAffordEntry = currentBalance >= entryFee
  const alreadyJoined = luckyDraw?.round?.hasJoined ?? false
  const roundAcceptingEntries = luckyDraw?.round?.status === "open"
  const joinDisabled = !luckyDraw?.round || alreadyJoined || !canAffordEntry || !roundAcceptingEntries || joinLoading
  const joinTooltip = !canAffordEntry
    ? "Insufficient balance"
    : alreadyJoined
      ? "You're already in this round"
      : !roundAcceptingEntries
        ? "This round has closed"
        : ""
  const winnerSnapshot = luckyDraw?.previousRound?.winnerSnapshot ?? null

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

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
            <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-orange-400 via-rose-500 to-amber-400 text-white shadow-2xl">
              <div className="pointer-events-none absolute -top-24 -right-32 h-72 w-72 rounded-full bg-white/25 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 -left-28 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
              <div className="p-8 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/80">Blind Box Lucky Draw</p>
                    <h2 className="text-3xl font-extrabold leading-snug tracking-tight flex items-center gap-2">
                      <Gift className="h-7 w-7" /> BLIND BOX LUCKY DRAW
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
                {luckyDrawLoading ? (
                  <div className="flex items-center gap-3 rounded-3xl bg-white/10 px-4 py-3 text-white/85">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Calculating the next reward window…</span>
                  </div>
                ) : (
                  <>
                    <p className="max-w-2xl text-base leading-relaxed text-white/90">
                      Pay {formatCurrency(entryFee)} to join the game and enter the lucky draw to win {formatCurrency(prizePool)}.
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
                              Play Now
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
                          Play Now
                        </Button>
                      )}
                      {joinTooltip ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="secondary"
                              onClick={() => setIsBlindBoxModalOpen(true)}
                              disabled={joinDisabled}
                              className={cn(
                                "bg-white/20 text-white border border-white/40 hover:bg-white/30",
                                joinDisabled && "cursor-not-allowed opacity-70",
                              )}
                            >
                              Buy for {formatCurrency(entryFee)}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{joinTooltip}</TooltipContent>
                        </Tooltip>
                      ) : (
                        <Button
                          variant="secondary"
                          onClick={() => setIsBlindBoxModalOpen(true)}
                          disabled={joinDisabled}
                          className="bg-white/20 text-white border border-white/40 hover:bg-white/30"
                        >
                          Buy for {formatCurrency(entryFee)}
                        </Button>
                      )}
                    </div>
                    <div className="rounded-3xl bg-white/15 p-4 backdrop-blur-sm text-sm text-white/90">
                      Get an item worth a fortune for just {formatCurrency(entryFee)}! Simply click to participate.
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
                          <CalendarDays className="mr-2 h-4 w-4" /> Every {luckyDraw?.config?.cycleHours ?? 72}h
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

            <Card className="relative overflow-hidden border-none rounded-[28px] bg-gradient-to-br from-emerald-300 via-emerald-200 to-teal-200 text-emerald-900 shadow-2xl">
              <div className="pointer-events-none absolute -top-20 -right-28 h-64 w-64 rounded-full bg-white/40 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-16 -left-20 h-52 w-52 rounded-full bg-white/30 blur-3xl" />
              <CardHeader className="space-y-3 pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-900/70">Mintmine Pro Rewards Center</p>
                    <CardTitle className="text-2xl font-bold leading-tight flex items-center gap-2">
                      <UsersIcon className="h-6 w-6" /> Invite &amp; Earn
                    </CardTitle>
                  </div>
                  <Share2 className="h-7 w-7 text-emerald-900/70" />
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-base leading-relaxed text-emerald-900/90">
                  Earn 10% of your friends' daily mining rewards when they join with your link.
                </p>
                <div className="rounded-2xl bg-white/70 p-4 shadow-sm">
                  <p className="text-sm font-semibold text-emerald-900/80">Your Referral Code</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <span className="rounded-xl bg-emerald-100 px-3 py-2 font-mono text-sm font-bold tracking-wide text-emerald-700">
                      {referralCode || "Unavailable"}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(referralCode, "Referral code copied!")}
                      disabled={!referralCode}
                      className="border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                    >
                      <Copy className="mr-2 h-4 w-4" /> Copy Code
                    </Button>
                  </div>
                  <p className="mt-3 text-sm text-emerald-700/80">{referralStatsText}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    onClick={() => setIsShareModalOpen(true)}
                    className="bg-white text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 shadow-lg hover:shadow-xl transition duration-200"
                  >
                    Share &amp; Invite
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleCopy(referralCode, "Referral code copied!")}
                    disabled={!referralCode}
                    className="bg-emerald-600/10 text-emerald-900 border border-emerald-500/30 hover:bg-emerald-600/20"
                  >
                    Copy Referral Code
                  </Button>
                </div>
                {copyMessage && (
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-900">
                    <Sparkles className="h-4 w-4" />
                    <span>{copyMessage}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Dialog open={isBlindBoxModalOpen} onOpenChange={setIsBlindBoxModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Gift className="h-5 w-5 text-orange-500" /> Blind Box Lucky Draw
            </DialogTitle>
            <DialogDescription>
              Join the current round for {formatCurrency(entryFee)}. This amount will be deducted from your balance instantly and
              grants you a shot at {formatCurrency(prizePool)}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900 space-y-2">
              <p className="font-semibold">Entry Fee: {formatCurrency(entryFee)}</p>
              <p className="font-semibold">Prize Pool: {formatCurrency(prizePool)}</p>
              <p className="text-orange-800/80">
                Next draw takes place at {nextDrawUtc}. Your balance currently shows {formatCurrency(currentBalance)}.
              </p>
            </div>
            <Button
              className="w-full bg-gradient-to-r from-orange-500 to-pink-500 text-white hover:from-orange-600 hover:to-pink-600"
              onClick={handleConfirmJoin}
              disabled={joinDisabled}
            >
              {joinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm & Join"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Participation is logged under your rewards history immediately after confirmation.
            </p>
            {!canAffordEntry && (
              <p className="text-xs text-center text-orange-700">You need at least {formatCurrency(entryFee)} in your balance to join.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isShareModalOpen} onOpenChange={setIsShareModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg text-emerald-900">
              <UsersIcon className="h-5 w-5" /> Share your Mintmine Pro link
            </DialogTitle>
            <DialogDescription>
              Send this link to your friends and earn 10% of their daily mining rewards when they join.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Referral Code</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 rounded-lg bg-muted px-3 py-2 font-mono text-sm">
                  {referralCode || "Unavailable"}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(referralCode, "Referral code copied!")}
                  disabled={!referralCode}
                >
                  <Copy className="mr-2 h-4 w-4" /> Copy
                </Button>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Referral Link</p>
              <div className="mt-2 flex items-center gap-2">
                <Input value={referralLink || "Link unavailable"} readOnly className="font-mono text-sm" />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCopy(referralLink, "Referral link copied!")}
                  disabled={!referralLink}
                >
                  <Copy className="mr-2 h-4 w-4" /> Copy Link
                </Button>
              </div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="font-semibold">Your invite performance</p>
              <p className="mt-1">{referralStatsText}</p>
            </div>
            {copyMessage && (
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                <Sparkles className="h-4 w-4" />
                <span>{copyMessage}</span>
              </div>
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
