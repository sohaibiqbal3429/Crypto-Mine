"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarDays, CheckCircle2, Clock, Copy, Crown, Gift, Info, Lock, Percent, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"

interface GiftBoxCycleSummary {
  id: string
  status: "open" | "completed"
  startTime: string
  endTime: string
  totalParticipants: number
  ticketPrice: number
  payoutPercentage: number
  winnerSnapshot: {
    name: string
    referralCode?: string | null
    email?: string | null
    creditedAt?: string | null
    payoutTxId?: string | null
  } | null
  winnerUserId: string | null
  fairnessProof: {
    serverSeed: string
    clientSeed: string
    nonce: number
    hash: string
    winnerIndex: number
  } | null
}

interface GiftBoxSummary {
  cycle: GiftBoxCycleSummary | null
  previousCycle: GiftBoxCycleSummary | null
  nextDrawAt: string | null
  participants: number
  config: {
    ticketPrice: number
    payoutPercentage: number
    cycleHours: number
    winnersCount: number
    autoDrawEnabled: boolean
    refundPercentage: number
    depositAddress: string
  }
  userStatus: {
    isParticipant: boolean
    joinedAt: string | null
    lastEntryTransactionId: string | null
    pendingDeposit: {
      id: string
      status: "pending" | "approved" | "rejected"
      submittedAt: string
      reviewedAt: string | null
      rejectionReason: string | null
      txId: string
      network: string
      address: string
    } | null
  }
}

interface GiftBoxHistoryCycle extends GiftBoxCycleSummary {}

interface GiftBoxDashboardProps {
  initialSummary: GiftBoxSummary
  initialHistory: GiftBoxHistoryCycle[]
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
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

function formatDate(value: string | null) {
  if (!value) return "TBA"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "TBA"
  return date.toLocaleString()
}

function calculateOdds(participants: number) {
  if (!participants || participants <= 0) return "--"
  if (participants === 1) return "100%"
  return `${(100 / participants).toFixed(2)}%`
}

export function GiftBoxDashboard({ initialSummary, initialHistory }: GiftBoxDashboardProps) {
  const { toast } = useToast()
  const [summary, setSummary] = useState<GiftBoxSummary>(initialSummary)
  const [history, setHistory] = useState<GiftBoxHistoryCycle[]>(initialHistory)
  const [countdown, setCountdown] = useState(formatCountdown(initialSummary.nextDrawAt))
  const [depositTxId, setDepositTxId] = useState("")
  const [depositNetwork, setDepositNetwork] = useState("TRC20")
  const [agreeToTerms, setAgreeToTerms] = useState(false)
  const [joining, setJoining] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const pendingDeposit = summary.userStatus.pendingDeposit
  const awaitingReview = pendingDeposit?.status === "pending"
  const rejectedDeposit = pendingDeposit?.status === "rejected"
  const alreadyJoined = summary.userStatus.isParticipant
  const disableJoin = alreadyJoined || awaitingReview
  const pendingTxLabel = pendingDeposit?.txId ? `${pendingDeposit.txId.slice(0, 10)}…` : "your transaction"
  const participantLabel = useMemo(
    () => new Intl.NumberFormat("en-US").format(summary.participants),
    [summary.participants],
  )

  const potSize = summary.participants * summary.config.ticketPrice
  const odds = calculateOdds(summary.participants)
  const payoutEstimate = (summary.participants * summary.config.ticketPrice * summary.config.payoutPercentage) / 100

  useEffect(() => {
    setCountdown(formatCountdown(summary.nextDrawAt))
    if (!summary.nextDrawAt) return

    const interval = window.setInterval(() => {
      setCountdown(formatCountdown(summary.nextDrawAt))
    }, 1000)

    return () => window.clearInterval(interval)
  }, [summary.nextDrawAt])

  const refreshSummary = useCallback(async () => {
    setRefreshing(true)
    try {
      const [summaryRes, historyRes] = await Promise.all([
        fetch("/api/giftbox/summary"),
        fetch("/api/giftbox/cycles?limit=10"),
      ])

      if (!summaryRes.ok) {
        const data = await summaryRes.json().catch(() => ({}))
        throw new Error(data.error || "Unable to refresh summary")
      }

      if (!historyRes.ok) {
        const data = await historyRes.json().catch(() => ({}))
        throw new Error(data.error || "Unable to refresh history")
      }

      const nextSummary = (await summaryRes.json()) as GiftBoxSummary
      const nextHistory = (await historyRes.json()) as { cycles: GiftBoxHistoryCycle[] }
      setSummary(nextSummary)
      setHistory(nextHistory.cycles ?? [])
    } catch (error: any) {
      toast({
        title: "Unable to refresh",
        description: error?.message ?? "Please try again later.",
        variant: "destructive",
      })
    } finally {
      setRefreshing(false)
    }
  }, [toast])

  const handleJoin = useCallback(async () => {
    if (awaitingReview) {
      toast({
        title: "Deposit under review",
        description: "We've received your transaction hash. Please wait for admin approval.",
      })
      return
    }
    if (alreadyJoined) {
      toast({ title: "Already joined", description: "You're locked in for this Gift Box cycle." })
      return
    }

    const trimmedTx = depositTxId.trim()
    if (trimmedTx.length < 10) {
      toast({
        title: "Deposit required",
        description: "Paste the blockchain transaction hash from your $10 deposit.",
        variant: "destructive",
      })
      return
    }

    if (!agreeToTerms) {
      toast({
        title: "Review the rules",
        description: "Please confirm the Gift Box Giveaway terms before joining.",
        variant: "destructive",
      })
      return
    }

    setJoining(true)
    try {
      const response = await fetch("/api/giftbox/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txId: trimmedTx,
          network: depositNetwork,
          address: summary.config.depositAddress,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || "Unable to join the giveaway")
      }

      toast({
        title: "Submission received",
        description: "Your deposit is pending admin review. We'll notify you once it's approved.",
      })

      setDepositTxId("")
      await refreshSummary()
    } catch (error: any) {
      toast({
        title: "Join failed",
        description: error?.message ?? "Please try again later.",
        variant: "destructive",
      })
    } finally {
      setJoining(false)
    }
  }, [agreeToTerms, alreadyJoined, awaitingReview, depositNetwork, depositTxId, refreshSummary, summary.config.depositAddress, toast])

  const handleCopyAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(summary.config.depositAddress)
      toast({
        title: "Address copied",
        description: "Send the $10 USDT deposit and keep the transaction hash ready.",
      })
    } catch (error) {
      toast({
        title: "Unable to copy",
        description: "Copy the deposit address manually.",
        variant: "destructive",
      })
    }
  }, [summary.config.depositAddress, toast])

  const nextDraw = summary.cycle ? summary.cycle.endTime : summary.nextDrawAt
  const nextDrawLabel = formatDate(nextDraw)
  const previousWinnerName = summary.previousCycle?.winnerSnapshot?.name ?? "To be announced"
  const previousWinnerTime = summary.previousCycle?.winnerSnapshot?.creditedAt
    ? formatDate(summary.previousCycle.winnerSnapshot.creditedAt)
    : null
  const fairness = summary.cycle?.fairnessProof ?? summary.previousCycle?.fairnessProof ?? null
  const canSubmitDeposit = !awaitingReview && depositTxId.trim().length >= 10

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[36px] bg-gradient-to-br from-[#6925d1] via-[#7a2cf5] to-[#9442ff] text-white shadow-2xl">
        <div className="pointer-events-none absolute -top-28 -left-24 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-28 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="relative space-y-8 p-10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.4em] text-white/70">Gift Box Giveaway</p>
              <h1 className="flex flex-wrap items-center gap-3 text-4xl font-extrabold tracking-tight">
                <Gift className="h-10 w-10" /> Secure your spot & win in {summary.config.cycleHours / 24} days
              </h1>
              <p className="max-w-2xl text-base text-white/85">
                Deposit {formatCurrency(summary.config.ticketPrice)} USDT to the wallet below and paste the blockchain
                transaction hash to lock in your seat. Funds remain escrowed until the draw closes and a winner is announced.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <Badge className="bg-white/20 text-white">
                  <Users className="mr-2 h-4 w-4" /> {participantLabel} participants
                </Badge>
                <Badge className="bg-white/20 text-white">
                  <CalendarDays className="mr-2 h-4 w-4" /> Next draw: {nextDrawLabel}
                </Badge>
                <Badge className="bg-white/20 text-white">
                  <Clock className="mr-2 h-4 w-4" /> Countdown: {countdown}
                </Badge>
              </div>
            </div>
            <div className="flex flex-col items-end gap-4">
              {alreadyJoined ? (
                <Badge variant="outline" className="border-white/30 bg-white/20 text-white">
                  You're already entered
                </Badge>
              ) : null}
              <Button
                onClick={() => void handleJoin()}
                disabled={disableJoin || joining || !canSubmitDeposit || !agreeToTerms}
                className="bg-white text-indigo-700 shadow-lg transition hover:bg-indigo-50 disabled:opacity-70"
              >
                {joining
                  ? "Submitting..."
                  : awaitingReview
                    ? "Under review"
                    : alreadyJoined
                      ? "Joined"
                      : canSubmitDeposit
                        ? "Submit for review"
                        : "Paste deposit hash"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => void refreshSummary()}
                disabled={refreshing}
                className="border-white/40 bg-white/20 text-white hover:bg-white/30"
              >
                {refreshing ? "Refreshing..." : "Refresh status"}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-2xl bg-white/15 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-white/70">Ticket price</p>
              <p className="mt-2 text-2xl font-bold">{formatCurrency(summary.config.ticketPrice)}</p>
              <p className="text-sm text-white/80">Single entry per cycle. Each draw requires a fresh deposit.</p>
            </div>
            <div className="rounded-2xl bg-white/15 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-white/70">Current pot</p>
              <p className="mt-2 text-2xl font-bold">{formatCurrency(potSize)}</p>
              <p className="text-sm text-white/80">Total escrowed funds for this cycle.</p>
            </div>
            <div className="rounded-2xl bg-white/15 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-white/70">Payout</p>
              <p className="mt-2 text-2xl font-bold">{formatCurrency(payoutEstimate || 0)}</p>
              <p className="text-sm text-white/80">{summary.config.payoutPercentage}% of the pot credited instantly.</p>
            </div>
            <div className="rounded-2xl bg-white/15 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-white/70">Your odds</p>
              <p className="mt-2 text-2xl font-bold">{odds}</p>
              <p className="text-sm text-white/80">Updates automatically as new entrants join.</p>
            </div>
            <div className="rounded-2xl bg-white/15 p-4 sm:col-span-4">
              <p className="text-xs uppercase tracking-[0.3em] text-white/70">Deposit address</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-mono text-sm text-white/90">{summary.config.depositAddress}</p>
                <Button
                  type="button"
                  onClick={() => void handleCopyAddress()}
                  className="w-full bg-white/20 text-white hover:bg-white/30 sm:w-auto"
                  variant="secondary"
                >
                  <Copy className="mr-2 h-4 w-4" /> Copy address
                </Button>
              </div>
              <p className="mt-2 text-xs text-white/75">
                Send exactly {formatCurrency(summary.config.ticketPrice)} in USDT. Paste the transaction hash below to confirm
                your entry. Deposits are non-refundable ({summary.config.refundPercentage}% refund rate).
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Network</Label>
                  <Select value={depositNetwork} onValueChange={setDepositNetwork}>
                    <SelectTrigger className="h-11 rounded-xl border-white/30 bg-white/10 text-white">
                      <SelectValue placeholder="Select network" />
                    </SelectTrigger>
                    <SelectContent className="bg-white text-slate-900">
                      <SelectItem value="TRC20">TRC20 (Tron)</SelectItem>
                      <SelectItem value="BEP20">BEP20 (BNB Smart Chain)</SelectItem>
                      <SelectItem value="ERC20">ERC20 (Ethereum)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="giftbox-tx" className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                    Deposit transaction hash
                  </Label>
                  <Input
                    id="giftbox-tx"
                    value={depositTxId}
                    onChange={(event) => setDepositTxId(event.target.value)}
                    placeholder="Paste your $10 USDT transaction hash"
                    className="h-11 rounded-xl border-white/30 bg-white/10 text-white placeholder:text-white/50"
                  />
                  <label className={cn("flex items-start gap-2 text-xs text-white/80", agreeToTerms ? "" : "text-white")}> 
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 rounded border-white/30 bg-white/10"
                      checked={agreeToTerms}
                      onChange={(event) => setAgreeToTerms(event.target.checked)}
                    />
                    <span>
                      I confirm that I am eligible, understand funds remain escrowed until the draw completes, and accept that
                      non-winners receive no refund.
                    </span>
                  </label>
                </div>
              </div>
              {awaitingReview ? (
                <div className="mt-4 rounded-xl border border-white/30 bg-white/10 p-4 text-sm text-white/85">
                  <p className="font-semibold text-white">Deposit under review</p>
                  <p className="mt-1">
                    We're verifying transaction {pendingTxLabel} on the {pendingDeposit?.network ?? "selected"} network. You'll
                    be notified once it's approved.
                  </p>
                </div>
              ) : null}
              {rejectedDeposit ? (
                <div className="mt-4 rounded-xl border border-rose-300/60 bg-rose-500/20 p-4 text-sm text-rose-100">
                  <p className="font-semibold text-rose-50">Deposit rejected</p>
                  <p className="mt-1">
                    {rejectedDeposit.rejectionReason || "Please submit a new transaction hash to try again."}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-white/85">
            <Crown className="h-5 w-5" />
            <span>
              Last winner: <strong>{previousWinnerName}</strong>
              {previousWinnerTime ? ` • Credited at ${previousWinnerTime}` : ""}
            </span>
          </div>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-indigo-500" /> Cycle status
          </CardTitle>
          <CardDescription>
            Auto draw is {summary.config.autoDrawEnabled ? "enabled" : "disabled"}. When enabled the platform finalizes the
            giveaway automatically at the scheduled end time.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-muted-foreground/20 bg-muted/40 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Joined at</p>
            <p className="mt-2 text-lg font-semibold text-foreground">
              {summary.userStatus.joinedAt ? formatDate(summary.userStatus.joinedAt) : "Not yet joined"}
            </p>
            <p className="text-sm text-muted-foreground">Timestamp of your latest confirmed entry.</p>
          </div>
          <div className="rounded-xl border border-muted-foreground/20 bg-muted/40 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Participants</p>
            <p className="mt-2 text-lg font-semibold text-foreground">{participantLabel}</p>
            <p className="text-sm text-muted-foreground">Unique entrants competing in this cycle.</p>
          </div>
          <div className="rounded-xl border border-muted-foreground/20 bg-muted/40 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Provably fair hash</p>
            <p className="mt-2 truncate text-lg font-semibold text-foreground">
              {fairness ? fairness.hash.slice(0, 24) + "…" : "Pending draw"}
            </p>
            <p className="text-sm text-muted-foreground">SHA256(serverSeed:clientSeed:nonce)</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-indigo-500" /> Provably fair log
          </CardTitle>
          <CardDescription>
            Every draw is anchored to a unique server seed, client seed, and nonce. Recompute the hash to verify the selected
            winner index.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 text-sm">
            <p className="text-muted-foreground">Server seed</p>
            <p className="font-mono text-xs text-foreground/90 break-all">{fairness?.serverSeed ?? "Will publish at draw"}</p>
          </div>
          <div className="space-y-1 text-sm">
            <p className="text-muted-foreground">Client seed</p>
            <p className="font-mono text-xs text-foreground/90 break-all">{fairness?.clientSeed ?? "Aggregated at draw"}</p>
          </div>
          <div className="space-y-1 text-sm">
            <p className="text-muted-foreground">Nonce</p>
            <p className="font-mono text-xs text-foreground/90">{fairness ? fairness.nonce : "Pending"}</p>
          </div>
          <div className="space-y-1 text-sm">
            <p className="text-muted-foreground">Winner index</p>
            <p className="font-mono text-xs text-foreground/90">{fairness ? fairness.winnerIndex : "Pending"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5 text-indigo-500" /> Giveaway history
          </CardTitle>
          <CardDescription>Review the latest completed cycles and verify payouts.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cycle</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Pot</TableHead>
                <TableHead>Payout</TableHead>
                <TableHead>Winner</TableHead>
                <TableHead>Fairness hash</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    No completed cycles yet. Your entry could be the first winner!
                  </TableCell>
                </TableRow>
              ) : (
                history.map((cycle) => {
                  const cyclePot = cycle.totalParticipants * cycle.ticketPrice
                  const cyclePayout = (cyclePot * cycle.payoutPercentage) / 100
                  return (
                    <TableRow key={cycle.id}>
                      <TableCell className="font-medium">{cycle.id.slice(-6).toUpperCase()}</TableCell>
                      <TableCell>
                        {formatDate(cycle.startTime)}
                        <br />
                        <span className="text-xs text-muted-foreground">→ {formatDate(cycle.endTime)}</span>
                      </TableCell>
                      <TableCell>{formatCurrency(cyclePot)}</TableCell>
                      <TableCell>{formatCurrency(cyclePayout)}</TableCell>
                      <TableCell>
                        {cycle.winnerSnapshot ? (
                          <div className="space-y-1 text-sm">
                            <div className="font-medium">{cycle.winnerSnapshot.name}</div>
                            <div className="text-xs text-muted-foreground">{cycle.winnerSnapshot.email ?? "Email hidden"}</div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Pending</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {cycle.fairnessProof ? cycle.fairnessProof.hash.slice(0, 24) + "…" : "TBA"}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-indigo-500" /> Giveaway rules
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground">
          <p>• Each entry requires a fresh {formatCurrency(summary.config.ticketPrice)} USDT deposit.</p>
          <p>
            • Funds remain in escrow until the scheduled draw time. Once the cycle ends, the system selects a winner using the
            published fairness proof.
          </p>
          <p>
            • The winner receives {summary.config.payoutPercentage}% of the pot directly into their in-app wallet. Remaining
            funds are retained by the platform as operational fees.
          </p>
          <p>• Non-winners maintain their account balance; deposits are non-refundable ({summary.config.refundPercentage}%).</p>
          <p>• Entries are limited to one per account per cycle. Duplicate submissions are automatically rejected.</p>
        </CardContent>
      </Card>
    </div>
  )
}
