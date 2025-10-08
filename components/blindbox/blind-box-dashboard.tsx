"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarDays, Clock, Copy, Crown, Gift, Sparkles, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const BLIND_BOX_DEPOSIT_ADDRESS = "TRhSCE8igyVmMuuRqukZEQDkn3MuEAdvfw"

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

interface BlindBoxSummary {
  round: BlindBoxRoundSummary | null
  previousRound: BlindBoxRoundSummary | null
  nextDrawAt: string | null
  participants: number
  config: {
    depositAmount: number
    rewardAmount: number
    cycleHours: number
    autoDrawEnabled: boolean
  }
  userStatus: {
    isParticipant: boolean
    joinedAt: string | null
    lastEntryTransactionId: string | null
  }
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
  initialSummary: BlindBoxSummary
  initialHistory: BlindBoxHistoryRound[]
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

export function BlindBoxDashboard({ initialSummary, initialHistory }: BlindBoxDashboardProps) {
  const { toast } = useToast()
  const [summary, setSummary] = useState<BlindBoxSummary>(initialSummary)
  const [history, setHistory] = useState<BlindBoxHistoryRound[]>(initialHistory)
  const [countdown, setCountdown] = useState(formatCountdown(initialSummary.nextDrawAt))
  const [joining, setJoining] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [depositTxId, setDepositTxId] = useState("")
  const [depositNetwork, setDepositNetwork] = useState("TRC20")
  const alreadyJoined = summary.userStatus.isParticipant

  const participantLabel = useMemo(
    () => new Intl.NumberFormat("en-US").format(summary.participants),
    [summary.participants],
  )

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
        fetch("/api/blindbox/summary"),
        fetch("/api/blindbox/rounds?limit=10"),
      ])

      if (!summaryRes.ok) {
        const data = await summaryRes.json().catch(() => ({}))
        throw new Error(data.error || "Unable to refresh summary")
      }

      if (!historyRes.ok) {
        const data = await historyRes.json().catch(() => ({}))
        throw new Error(data.error || "Unable to refresh history")
      }

      const nextSummary = (await summaryRes.json()) as BlindBoxSummary
      const nextHistory = (await historyRes.json()) as { rounds: BlindBoxHistoryRound[] }
      setSummary(nextSummary)
      setHistory(nextHistory.rounds ?? [])
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
    if (alreadyJoined) {
      toast({ title: "Already joined", description: "You're part of the current round." })
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

    setJoining(true)
    try {
      const response = await fetch("/api/blindbox/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txId: trimmedTx,
          network: depositNetwork,
          address: BLIND_BOX_DEPOSIT_ADDRESS,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || "Unable to join the blind box")
      }

      toast({
        title: "Entry confirmed",
        description: "You're now part of the current Blind Box round.",
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
  }, [alreadyJoined, depositNetwork, depositTxId, refreshSummary, toast])

  const handleCopyAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(BLIND_BOX_DEPOSIT_ADDRESS)
      toast({
        title: "Address copied",
        description: "Send exactly $10 USDT and keep the transaction hash ready for submission.",
      })
    } catch (error) {
      toast({
        title: "Unable to copy",
        description: "Copy the deposit address manually.",
        variant: "destructive",
      })
    }
  }, [toast])

  const entryFee = summary.config.depositAmount
  const prizePool = summary.config.rewardAmount
  const nextDraw = summary.round ? summary.round.endTime : summary.nextDrawAt
  const nextDrawLabel = formatDate(nextDraw)

  const previousWinnerName = summary.previousRound?.winnerSnapshot?.name ?? "To be announced"
  const previousWinnerTime = summary.previousRound?.winnerSnapshot?.creditedAt
    ? formatDate(summary.previousRound.winnerSnapshot.creditedAt)
    : null
  const canSubmitDeposit = depositTxId.trim().length >= 10

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[36px] bg-gradient-to-br from-[#ff7eb3] via-[#ff758c] to-[#ff5277] text-white shadow-2xl">
        <div className="pointer-events-none absolute -top-28 -left-24 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-28 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="relative p-10 space-y-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.4em] text-white/75">Blind Box</p>
              <h1 className="flex flex-wrap items-center gap-3 text-4xl font-extrabold tracking-tight">
                <Gift className="h-10 w-10" /> Join &amp; Win Every {summary.config.cycleHours} Hours
              </h1>
              <p className="max-w-2xl text-base text-white/85">
                Deposit {formatCurrency(entryFee)} USDT to the wallet below and paste the blockchain transaction hash to lock
                in your spot for {formatCurrency(prizePool)}. Draws run on a fixed schedule so you always know when the next
                winner will be announced.
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
                <Badge variant="outline" className="bg-white/20 border-white/30 text-white">
                  You're already in!
                </Badge>
              ) : null}
              <Button
                onClick={() => void handleJoin()}
                disabled={alreadyJoined || joining || !canSubmitDeposit}
                className="bg-white text-rose-600 hover:bg-rose-50 hover:text-rose-700 shadow-lg disabled:opacity-70"
              >
                {joining
                  ? "Processing..."
                  : alreadyJoined
                    ? "Joined"
                    : canSubmitDeposit
                      ? "Confirm Entry"
                      : "Paste Deposit Hash"}
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

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/15 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-white/70">Entry Fee</p>
              <p className="mt-2 text-2xl font-bold">{formatCurrency(entryFee)}</p>
              <p className="text-sm text-white/80">Provide the blockchain hash of your $10 deposit to participate.</p>
            </div>
            <div className="rounded-2xl bg-white/15 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-white/70">Prize Pool</p>
              <p className="mt-2 text-2xl font-bold">{formatCurrency(prizePool)}</p>
              <p className="text-sm text-white/80">Winner receives an automatic balance credit.</p>
            </div>
            <div className="rounded-2xl bg-white/15 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-white/70">Countdown</p>
              <p className="mt-2 text-2xl font-bold">{countdown}</p>
              <p className="text-sm text-white/80">Draw closes at {nextDrawLabel}.</p>
            </div>
            <div className="rounded-2xl bg-white/15 p-4 sm:col-span-3">
              <p className="text-xs uppercase tracking-[0.3em] text-white/70">Deposit Address</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-mono text-sm text-white/90">{BLIND_BOX_DEPOSIT_ADDRESS}</p>
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
                Send exactly {formatCurrency(entryFee)} in USDT. Paste the transaction hash below to confirm your blind box
                entry.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                    Network
                  </Label>
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
                  <Label htmlFor="blindbox-tx" className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                    Deposit transaction hash
                  </Label>
                  <Input
                    id="blindbox-tx"
                    value={depositTxId}
                    onChange={(event) => setDepositTxId(event.target.value)}
                    placeholder="Paste your $10 USDT transaction hash"
                    className="h-11 rounded-xl border-white/30 bg-white/10 text-white placeholder:text-white/50"
                  />
                  <p className="text-[11px] text-white/65">
                    Each round requires a fresh $10 deposit. Admins verify hashes if anything looks suspicious.
                  </p>
                </div>
              </div>
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
            <Sparkles className="h-5 w-5 text-amber-500" /> Round details
          </CardTitle>
          <CardDescription>
            Auto draw is {summary.config.autoDrawEnabled ? "enabled" : "disabled"}. When enabled the system finalizes the round
            automatically at the scheduled end time.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
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
            <p className="text-sm text-muted-foreground">Unique entrants currently competing in this round.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent rounds</CardTitle>
          <CardDescription>Track previous winners and payouts.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ended</TableHead>
                <TableHead>Participants</TableHead>
                <TableHead>Prize</TableHead>
                <TableHead>Winner</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                    No historical rounds yet.
                  </TableCell>
                </TableRow>
              ) : (
                history.map((round) => (
                  <TableRow key={round.id}>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(round.endTime)}</TableCell>
                    <TableCell>{round.totalParticipants}</TableCell>
                    <TableCell>{formatCurrency(round.rewardAmount)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {round.winnerSnapshot?.name ?? "TBD"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
