"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertCircle, CheckCircle, Clock3, Crown, Loader2, RefreshCcw, Sparkle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"

interface BlindBoxRoundSummary {
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

interface BlindBoxConfig {
  depositAmount: number
  rewardAmount: number
  cycleHours: number
  autoDrawEnabled: boolean
}

interface BlindBoxUserStatus {
  isParticipant: boolean
  hasPendingDeposit: boolean
  pendingTxId: string | null
  lastDepositStatus: "pending" | "approved" | "rejected" | null
}

interface BlindBoxHistoryRound {
  id: string
  startTime: string
  endTime: string
  status: "open" | "completed"
  totalParticipants: number
  rewardAmount: number
  depositAmount: number
  winnerUserId: string | null
  winnerSnapshot: {
    name: string
    referralCode?: string | null
    email?: string | null
    creditedAt?: string | null
  } | null
}

interface BlindBoxDashboardProps {
  initialSummary: {
    round: BlindBoxRoundSummary | null
    previousRound: BlindBoxRoundSummary | null
    nextDrawAt: string | null
    participants: number
    config: BlindBoxConfig
    userStatus: BlindBoxUserStatus
  }
  constants: {
    address: string
    network: string
  }
  initialHistory: BlindBoxHistoryRound[]
}

function formatCountdown(targetIso: string | null) {
  if (!targetIso) return "--:--:--"
  const target = new Date(targetIso)
  if (Number.isNaN(target.getTime())) return "--:--:--"

  const diff = target.getTime() - Date.now()
  if (diff <= 0) return "00:00:00"

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  return [hours, minutes, seconds].map((unit) => unit.toString().padStart(2, "0")).join(":")
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    amount,
  )
}

function formatDate(value: string | null) {
  if (!value) return "--"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "--"
  return date.toLocaleString()
}

function formatName(name?: string | null) {
  if (!name) return "Anonymous"
  return name
}

export function BlindBoxDashboard({ initialSummary, constants, initialHistory }: BlindBoxDashboardProps) {
  const { toast } = useToast()
  const [summary, setSummary] = useState(initialSummary)
  const [history, setHistory] = useState<BlindBoxHistoryRound[]>(initialHistory)
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(formatCountdown(initialSummary.nextDrawAt))
  const [isDepositOpen, setIsDepositOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [txId, setTxId] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const participantCount = useMemo(() => new Intl.NumberFormat("en-US").format(summary.participants), [summary.participants])

  useEffect(() => {
    setCountdown(formatCountdown(summary.nextDrawAt))
    if (!summary.nextDrawAt) return

    const interval = window.setInterval(() => {
      setCountdown(formatCountdown(summary.nextDrawAt))
    }, 1000)

    return () => window.clearInterval(interval)
  }, [summary.nextDrawAt])

  const reloadSummary = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/blindbox/summary")
      if (!response.ok) {
        throw new Error("Unable to load blind box summary")
      }
      const data = await response.json()
      setSummary({
        round: data.round,
        previousRound: data.previousRound,
        nextDrawAt: data.nextDrawAt,
        participants: data.participants,
        config: data.config,
        userStatus: data.userStatus,
      })
      setCountdown(formatCountdown(data.nextDrawAt))
    } catch (error: any) {
      console.error("Blind box summary refresh error", error)
      toast({ title: "Unable to refresh", description: error?.message ?? "Please try again later", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const reloadHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/blindbox/rounds?limit=10")
      if (!response.ok) {
        throw new Error("Unable to load winners history")
      }
      const data = await response.json()
      setHistory(data.rounds ?? [])
    } catch (error: any) {
      console.error("Blind box history error", error)
      toast({
        title: "Unable to load history",
        description: error?.message ?? "Please try again later",
        variant: "destructive",
      })
    }
  }, [toast])

  const handleSubmitDeposit = useCallback(async () => {
    const sanitized = txId.trim()
    if (!sanitized) {
      toast({ title: "Transaction hash required", variant: "destructive" })
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/blindbox/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txId: sanitized }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Unable to submit deposit")
      }

      toast({
        title: "Deposit submitted",
        description: "We will notify you once the transaction is verified.",
      })
      setTxId("")
      setIsDepositOpen(false)
      await reloadSummary()
    } catch (error: any) {
      console.error("Submit blind box deposit error", error)
      toast({
        title: "Unable to submit",
        description: error?.message ?? "Please verify your transaction hash and try again.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }, [reloadSummary, toast, txId])

  const lastWinner = summary.previousRound?.winnerSnapshot
  const nextDrawLabel = summary.nextDrawAt ? formatDate(summary.nextDrawAt) : "TBD"

  const qrCodeUrl = useMemo(() => {
    return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(constants.address)}&size=180x180`
  }, [constants.address])

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-pink-500/15 via-orange-500/10 to-yellow-500/15 p-6 shadow-xl backdrop-blur">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.4),rgba(255,255,255,0))]" />
      <div className="absolute -top-40 right-20 h-72 w-72 rounded-full bg-orange-400/20 blur-3xl" />
      <div className="absolute bottom-10 -left-32 h-80 w-80 rounded-full bg-pink-500/20 blur-3xl" />

      <div className="relative flex flex-col gap-10">
        <header className="text-center space-y-3">
          <Badge variant="secondary" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-sm text-white">
            <Sparkle className="h-4 w-4 animate-spin-slow" /> Blind Box Lucky Draw
          </Badge>
          <h1 className="text-4xl font-black text-white md:text-5xl">🎁 Win Exciting Rewards Every 72 Hours!</h1>
          <p className="mx-auto max-w-2xl text-base text-white/80 md:text-lg">
            Deposit ${summary.config.depositAmount} to join the lucky draw and get a chance to win {formatCurrency(summary.config.rewardAmount)}.
            Each draw resets automatically every {summary.config.cycleHours} hours.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-white/80">
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">
              <Crown className="h-4 w-4 text-yellow-200" /> Next draw in <span className="font-mono text-lg text-white">{countdown}</span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">
              <UsersIcon /> {participantCount} participants in this round
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">
              <Clock3 className="h-4 w-4" /> Next draw: {nextDrawLabel}
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <Card className="relative overflow-hidden border-white/20 bg-white/10 text-white shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-2xl font-semibold">
                Join the current draw
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reloadSummary}
                  disabled={loading}
                  className="gap-2 rounded-full bg-white/10 text-white hover:bg-white/20"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />} Refresh
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="grid gap-3 rounded-2xl bg-white/10 p-6">
                <div className="flex flex-wrap items-center gap-4 text-white/90">
                  <Badge className="bg-white/20 text-white">Entry: {formatCurrency(summary.config.depositAmount)}</Badge>
                  <Badge className="bg-white/20 text-white">Prize: {formatCurrency(summary.config.rewardAmount)}</Badge>
                  <Badge className="bg-white/20 text-white">Cycle: {summary.config.cycleHours}h</Badge>
                </div>
                <p className="text-sm text-white/80">
                  Deposits are manually verified by our compliance team. Once approved, you&apos;ll be added to the active participant list automatically.
                </p>
                {summary.userStatus.hasPendingDeposit && (
                  <div className="flex items-center gap-3 rounded-xl bg-yellow-500/20 px-4 py-3 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Pending verification for TxID <span className="font-mono text-xs">{summary.userStatus.pendingTxId}</span>
                  </div>
                )}
                {summary.userStatus.lastDepositStatus === "rejected" && !summary.userStatus.hasPendingDeposit && (
                  <div className="flex items-center gap-3 rounded-xl bg-red-500/20 px-4 py-3 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    Your last deposit request was rejected. Please double-check your transaction hash.
                  </div>
                )}
                {summary.userStatus.isParticipant && (
                  <div className="flex items-center gap-3 rounded-xl bg-emerald-500/20 px-4 py-3 text-sm">
                    <CheckCircle className="h-4 w-4" /> You&apos;re in! Stay tuned for the winner announcement.
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-4">
                <Button
                  size="lg"
                  className="flex-1 rounded-full bg-white text-lg font-semibold text-black shadow-lg transition hover:scale-[1.01] hover:bg-white/90"
                  onClick={() => setIsDepositOpen(true)}
                >
                  Deposit & Join Now
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-full border-white/30 bg-white/10 text-white hover:bg-white/20"
                  onClick={() => {
                    setIsHistoryOpen(true)
                    void reloadHistory()
                  }}
                >
                  View Past Winners
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <Card className="border-white/20 bg-white/10 text-white shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                  <Crown className="h-5 w-5 text-yellow-200" /> Last Winner
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {lastWinner ? (
                  <>
                    <p className="font-semibold text-white">{formatName(lastWinner.name)}</p>
                    <p className="text-white/80">Won {formatCurrency(summary.config.rewardAmount)}</p>
                    <p className="text-white/70 text-xs">Announced on {formatDate(lastWinner.creditedAt ?? summary.previousRound?.endTime ?? null)}</p>
                  </>
                ) : (
                  <p className="text-white/70">Winner details will appear once the current round completes.</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-white/20 bg-white/10 text-white shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <Sparkle className="h-5 w-5 text-pink-200" /> Why Blind Box?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-white/80">
                <p>• Secure deposits verified by the admin team</p>
                <p>• Transparent winner selection every 72 hours</p>
                <p>• Rewards are credited instantly to your main wallet</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <Dialog open={isDepositOpen} onOpenChange={setIsDepositOpen}>
          <DialogContent className="max-w-2xl border border-white/20 bg-slate-950/95 text-white">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-2xl font-bold">Deposit to Join the Blind Box Draw</DialogTitle>
              <DialogDescription className="text-white/70">
                Send exactly {formatCurrency(summary.config.depositAmount)} ({summary.config.depositAmount} USDT {constants.network}) to the address below and provide your transaction hash.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 md:grid-cols-[1fr,1fr]">
              <div className="space-y-4">
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-sm text-white/70">Wallet Address</p>
                  <p className="break-all font-mono text-sm text-white">{constants.address}</p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="rounded-full"
                      onClick={() => {
                        navigator.clipboard
                          ?.writeText(constants.address)
                          .then(() => toast({ title: "Address copied" }))
                          .catch(() => toast({ title: "Unable to copy address", variant: "destructive" }))
                      }}
                    >
                      Copy address
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full border-white/30 text-white hover:bg-white/10"
                      asChild
                    >
                      <Link
                        href={`https://tronscan.org/#/address/${constants.address}`}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        View on Tronscan
                      </Link>
                    </Button>
                  </div>
                </div>
                <div className="rounded-2xl bg-white/5 p-4 space-y-3">
                  <label className="text-sm text-white/70">Enter your transaction hash (TxID)</label>
                  <Input
                    value={txId}
                    onChange={(event) => setTxId(event.target.value)}
                    placeholder="Paste your TxID"
                    className="border-white/30 bg-transparent text-white placeholder:text-white/40 focus-visible:ring-white/40"
                  />
                </div>
              </div>
              <div className="flex flex-col items-center justify-center space-y-4 rounded-2xl border border-white/20 bg-white/5 p-6">
                <img
                  src={qrCodeUrl}
                  alt="Deposit address QR"
                  className="h-40 w-40 rounded-xl border border-white/10 bg-white/90 p-2 shadow-lg"
                />
                <p className="text-center text-xs text-white/70">
                  Scan the QR code with a TRC20-compatible wallet to populate the address automatically. Double-check the network and amount before sending.
                </p>
              </div>
            </div>
            <DialogFooter className="flex items-center justify-between gap-4 border-t border-white/10 pt-4">
              <div className="text-xs text-white/60">
                Need help? Contact support with your TxID and registered email.
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="rounded-full border-white/30 text-white hover:bg-white/10"
                  onClick={() => setIsDepositOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="rounded-full bg-white px-6 text-black hover:bg-white/90"
                  onClick={() => void handleSubmitDeposit()}
                  disabled={submitting}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Deposit Request"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
          <DialogContent className="max-w-3xl border border-white/10 bg-slate-950/95 text-white">
            <DialogHeader className="text-left">
              <DialogTitle className="text-2xl font-bold">Recent Blind Box Winners</DialogTitle>
              <DialogDescription className="text-white/70">
                Every round is recorded for full transparency. Only approved participants are included in each draw.
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="winners" className="space-y-4">
              <TabsList className="rounded-full bg-white/10 text-white">
                <TabsTrigger value="winners" className="data-[state=active]:bg-white data-[state=active]:text-black">
                  Winners
                </TabsTrigger>
                <TabsTrigger value="details" className="data-[state=active]:bg-white data-[state=active]:text-black">
                  Round details
                </TabsTrigger>
              </TabsList>
              <TabsContent value="winners" className="mt-0">
                <ScrollArea className="max-h-80 rounded-2xl border border-white/10">
                  <div className="divide-y divide-white/10">
                    {history.length === 0 && (
                      <div className="p-6 text-center text-sm text-white/70">No completed rounds yet. Check back soon!</div>
                    )}
                    {history.map((round) => (
                      <div key={round.id} className="flex items-center justify-between gap-4 p-4">
                        <div>
                          <p className="text-sm font-semibold text-white">{formatName(round.winnerSnapshot?.name)}</p>
                          <p className="text-xs text-white/60">Completed {formatDate(round.endTime)}</p>
                        </div>
                        <Badge className="rounded-full bg-white/15 text-white">{formatCurrency(round.rewardAmount)}</Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="details" className="mt-0">
                <ScrollArea className="max-h-80 rounded-2xl border border-white/10">
                  <div className="grid gap-4 p-4">
                    {history.map((round) => (
                      <div key={round.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-white">Round ended {formatDate(round.endTime)}</p>
                            <p className="text-xs text-white/60">Participants: {round.totalParticipants}</p>
                          </div>
                          <Badge className="rounded-full bg-white/15 text-white">
                            Prize: {formatCurrency(round.rewardAmount)}
                          </Badge>
                        </div>
                        <Separator className="my-3 bg-white/10" />
                        <p className="text-xs text-white/70">
                          Winner: {round.winnerSnapshot ? formatName(round.winnerSnapshot.name) : "Pending"}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

function UsersIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
      className="h-4 w-4"
      fill="none"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z"
      />
    </svg>
  )
}

// extend animation utility
const style = typeof document !== "undefined" ? document.createElement("style") : null
if (style && !document.querySelector("#blind-box-animations")) {
  style.id = "blind-box-animations"
  style.innerHTML = `
    @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .animate-spin-slow { animation: spin-slow 14s linear infinite; }
  `
  document.head.appendChild(style)
}
