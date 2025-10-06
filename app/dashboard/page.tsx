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
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [isBlindBoxModalOpen, setIsBlindBoxModalOpen] = useState(false)
  const [isLeaderboardModalOpen, setIsLeaderboardModalOpen] = useState(false)
  const [copyMessage, setCopyMessage] = useState<string | null>(null)
  const [referralLink, setReferralLink] = useState("")

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

  useEffect(() => {
    if (data?.user?.referralCode && typeof window !== "undefined") {
      const url = new URL("/auth/register", window.location.origin)
      url.searchParams.set("ref", data.user.referralCode)
      setReferralLink(url.toString())
    } else {
      setReferralLink("")
    }
  }, [data?.user?.referralCode])

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

  const referralCode = data?.user?.referralCode ?? ""
  const invitesCount = data?.kpis?.activeMembers ?? 0
  const referralEarnings = data?.kpis?.teamReward ?? 0
  const formattedReferralEarnings = useMemo(() => formatCurrency(referralEarnings), [referralEarnings])
  const nextDrawDateObj = useMemo(() => getNextDrawDate(), [])
  const nextDrawDate = useMemo(() => formatDrawDate(nextDrawDateObj), [nextDrawDateObj])
  const timeUntilNextDraw = useMemo(() => getTimeUntil(nextDrawDateObj), [nextDrawDateObj])
  const participantCount = useMemo(() => Math.max(3566, invitesCount * 12 + 500), [invitesCount])
  const participantLabel = useMemo(() => new Intl.NumberFormat("en-US").format(participantCount), [participantCount])
  const referralStatsText = `${invitesCount} active invites | ${formattedReferralEarnings} earned from referrals`
  const prizePool = 30

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

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <Card className="relative overflow-hidden border-none shadow-xl rounded-[20px] bg-gradient-to-br from-orange-500 via-rose-500 to-amber-400 text-white">
              <div className="pointer-events-none absolute -top-10 -right-16 h-40 w-40 rounded-full bg-white/20 blur-3xl" />
              <CardHeader className="space-y-4 pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-white/80">Blind Box Lucky Draw</p>
                    <CardTitle className="text-2xl font-bold leading-tight flex items-center gap-2">
                      <Gift className="h-6 w-6" />
                      🎁 Win Exciting Prizes Every 3 Days
                    </CardTitle>
                  </div>
                  <Sparkles className="h-8 w-8 text-white/80" />
                </div>
              </CardHeader>
              <CardContent className="space-y-5 text-white">
                <p className="text-base leading-relaxed">
                  Pay $10 to join the game and enter the lucky draw to win $30 every 3 days.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    onClick={() => setIsBlindBoxModalOpen(true)}
                    className="bg-gradient-to-r from-orange-400 via-orange-500 to-pink-500 text-white shadow-lg hover:shadow-2xl hover:scale-[1.02] transition duration-200 border border-white/20"
                  >
                    Play Now
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setIsBlindBoxModalOpen(true)}
                    className="bg-white/20 text-white border border-white/30 hover:bg-white/30 hover:text-white"
                  >
                    Buy for $10
                  </Button>
                </div>
                <div className="rounded-2xl bg-white/15 p-4 backdrop-blur-sm">
                  <p className="text-sm text-white/90">
                    Get an item worth a fortune for just $10! Simply click below and participate.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-white/80">
                  <Sparkles className="h-4 w-4" />
                  <span>
                    ⭐ {participantLabel} users have participated — next winner announced on {nextDrawDate}.
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-none shadow-xl rounded-[20px] bg-gradient-to-br from-emerald-500 via-emerald-400 to-teal-400 text-emerald-950">
              <div className="pointer-events-none absolute -bottom-12 -left-16 h-40 w-40 rounded-full bg-white/30 blur-3xl" />
              <CardHeader className="space-y-3 pb-0 text-emerald-950">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-emerald-900/70">
                      Mintmine Pro Rewards Center
                    </p>
                    <CardTitle className="text-2xl font-bold leading-tight flex items-center gap-2">
                      <UsersIcon className="h-6 w-6" />
                      💎 Invite & Earn
                    </CardTitle>
                  </div>
                  <Share2 className="h-7 w-7 text-emerald-900/70" />
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-base leading-relaxed text-emerald-900/90">
                  Invite your friends and earn 10% of their daily mining rewards.
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

            <Card className="relative overflow-hidden border-none shadow-xl rounded-[20px] bg-gradient-to-br from-sky-400 via-sky-300 to-cyan-300 text-sky-950 md:col-span-2 xl:col-span-1">
              <div className="pointer-events-none absolute -top-16 -left-12 h-40 w-40 rounded-full bg-white/40 blur-3xl" />
              <CardHeader className="space-y-3 pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-sky-900/70">Weekly Winner Overview</p>
                    <CardTitle className="text-2xl font-bold leading-tight flex items-center gap-2">
                      <Trophy className="h-6 w-6" />
                      🏆 Current Round Overview
                    </CardTitle>
                  </div>
                  <CalendarDays className="h-7 w-7 text-sky-900/70" />
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-2xl bg-white/70 p-4 shadow-sm space-y-3">
                  <p className="text-sm font-medium text-sky-900/80">
                    Total Entries: <span className="font-semibold">{participantLabel} participants</span>
                  </p>
                  <p className="text-sm font-medium text-sky-900/80">
                    Prize Pool: <span className="font-semibold">{formatCurrency(prizePool)}</span>
                  </p>
                  <p className="text-sm font-medium text-sky-900/80">
                    Next Draw: <span className="font-semibold">{nextDrawDate}</span> • {timeUntilNextDraw}
                  </p>
                </div>
                <Button
                  onClick={() => setIsLeaderboardModalOpen(true)}
                  className="bg-slate-900 text-white hover:bg-slate-800 shadow-lg hover:shadow-xl transition duration-200"
                >
                  View Leaderboard
                </Button>
                <p className="text-sm text-sky-900/80">
                  Winners are automatically credited — check results in <span className="font-semibold">History &gt; Rewards</span>.
                </p>
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
              Confirm your participation to enter the next $30 prize draw. The next winner will be announced on {nextDrawDate}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
              <p className="font-semibold">Entry Fee: $10</p>
              <p className="mt-1 text-orange-800/80">Your chance to win ${prizePool} every 3 days. Good luck!</p>
            </div>
            <Button className="w-full bg-gradient-to-r from-orange-500 to-pink-500 text-white hover:from-orange-600 hover:to-pink-600">
              Confirm &amp; Play
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Participation will be logged under your rewards history after confirmation.
            </p>
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
            <p>Next draw happens on {nextDrawDate}. Check back then for the updated leaderboard.</p>
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

const DRAW_INTERVAL_DAYS = 3

function getNextDrawDate() {
  const now = new Date()
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)

  const dayCount = Math.floor(startOfDay.getTime() / (1000 * 60 * 60 * 24))
  const remainder = dayCount % DRAW_INTERVAL_DAYS
  const daysToAdd = remainder === 0 ? DRAW_INTERVAL_DAYS : DRAW_INTERVAL_DAYS - remainder

  const nextDate = new Date(startOfDay)
  nextDate.setDate(startOfDay.getDate() + daysToAdd)
  return nextDate
}

function formatDrawDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date)
}

function getTimeUntil(date: Date) {
  const diffMs = date.getTime() - Date.now()
  if (diffMs <= 0) {
    return "Less than 1 hour"
  }

  const totalMinutes = Math.floor(diffMs / (1000 * 60))
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0 && days === 0) parts.push(`${minutes}m`)

  return parts.join(" ") || "Under 1h"
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}
