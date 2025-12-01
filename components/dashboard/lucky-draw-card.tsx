"use client"

import type { ReactNode } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { differenceInSeconds, format } from "date-fns"
import { CalendarDays, Gift, History, RefreshCw, Timer } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useLuckyDrawDeposits } from "@/hooks/use-lucky-draw-deposits"
import type { LuckyDrawDeposit, LuckyDrawRound, LuckyDrawDepositStatus } from "@/lib/types/lucky-draw"
import { LuckyDrawDepositModal } from "@/components/lucky-draw/deposit-modal"

const REQUIRED_AMOUNT = 10

interface LuckyDrawCardProps {
  round?: LuckyDrawRound
  deposits?: LuckyDrawDeposit[]
  onDepositSubmit?: (deposit: LuckyDrawDeposit) => void
  currentUser?: {
    id?: string
    _id?: string
    name?: string
    email?: string
  }
}

export function LuckyDrawCard({ round, deposits: depositsProp }: LuckyDrawCardProps) {
  const {
    deposits: storedDeposits,
    loading: depositsLoading,
    error: depositsError,
    refresh: refreshDeposits,
  } = useLuckyDrawDeposits({ scope: "user" })

  const [localRound] = useState<LuckyDrawRound>(
    round ?? {
      id: "demo-round",
      startAtUtc: new Date().toISOString(),
      endAtUtc: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      prizePoolUsd: 30,
      announcementAtUtc: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      selectedWinner: null,
      lastWinner: {
        name: "Wallet Ninja",
        announcedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
    },
  )

  const deposits = depositsProp ?? storedDeposits

  const [depositModalOpen, setDepositModalOpen] = useState(false)
  const [remoteRound, setRemoteRound] = useState<LuckyDrawRound | null>(null)
  const [roundError, setRoundError] = useState<string | null>(null)
  const [roundLoading, setRoundLoading] = useState(false)

  const approvedEntries = useMemo(
    () => deposits.filter((deposit) => deposit.status === "APPROVED").length,
    [deposits],
  )

  const hasApprovedPurchase = useMemo(
    () =>
      deposits.some(
        (deposit) =>
          deposit.status === "APPROVED" && Math.abs(deposit.amountUsd - REQUIRED_AMOUNT) < 0.01,
      ),
    [deposits],
  )

  const activeRound = round ?? remoteRound ?? localRound
  const announcementDate = useMemo(
    () => new Date(activeRound.announcementAtUtc ?? activeRound.endAtUtc),
    [activeRound],
  )
  const roundStartDate = useMemo(() => new Date(activeRound.startAtUtc), [activeRound])
  const winnerSelection = activeRound.selectedWinner ?? null
  const winnerSelectionDate = useMemo(
    () => (winnerSelection ? new Date(winnerSelection.selectedAt) : null),
    [winnerSelection],
  )
  const isAnnouncementPending = useMemo(
    () => Boolean(winnerSelection && announcementDate.getTime() > Date.now()),
    [winnerSelection, announcementDate],
  )

  const [countdown, setCountdown] = useState<string>(() => formatRemaining(announcementDate))

  useEffect(() => {
    setCountdown(formatRemaining(announcementDate))
    const interval = setInterval(() => {
      setCountdown(formatRemaining(announcementDate))
    }, 1000)

    return () => clearInterval(interval)
  }, [announcementDate])

  const highlightedDeposit = useMemo(() => {
    if (deposits.length === 0) {
      return null
    }

    const exactMatch = deposits.find(
      (deposit) => Math.abs(deposit.amountUsd - REQUIRED_AMOUNT) < 0.01,
    )
    return exactMatch ?? deposits[0]
  }, [deposits])

  const latestWinner = activeRound.lastWinner

  const handleDepositSuccess = useCallback(
    (_deposit?: LuckyDrawDeposit) => {
      refreshDeposits()
    },
    [refreshDeposits],
  )

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    const fetchRound = async () => {
      setRoundLoading(true)
      setRoundError(null)
      try {
        const response = await fetch("/api/lucky-draw/round", {
          cache: "no-store",
          signal: controller.signal,
        })
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          const message = typeof payload?.error === "string" ? payload.error : "Unable to load round"
          throw new Error(message)
        }

        if (!cancelled && payload?.round) {
          setRemoteRound(payload.round as LuckyDrawRound)
        }
      } catch (error) {
        if ((error as Error).name === "AbortError" || cancelled) {
          return
        }
        console.error("Lucky draw round fetch failed", error)
        setRoundError(error instanceof Error ? error.message : "Unable to load round")
      } finally {
        if (!cancelled) {
          setRoundLoading(false)
        }
      }
    }

    fetchRound()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  const statusAlert = useMemo(() => {
    if (!highlightedDeposit) {
      return null
    }

    const amount = highlightedDeposit.amountUsd.toFixed(2)
    const submittedAt = format(new Date(highlightedDeposit.submittedAt), "MMM d, yyyy • HH:mm 'UTC'")

    switch (highlightedDeposit.status) {
      case "APPROVED":
        return {
          variant: "default" as const,
          title: "Deposit approved",
          description: `Your deposit of $${amount} has been approved and credited. Submitted ${submittedAt}.`,
        }
      case "REJECTED":
        return {
          variant: "destructive" as const,
          title: "Deposit rejected",
          description:
            `Your deposit of $${amount} was rejected. Please double-check your receipt and contact support if you need help. Submitted ${submittedAt}.`,
        }
      default:
        return {
          variant: "default" as const,
          title: "Deposit pending review",
          description: `Your deposit of $${amount} is awaiting admin review. Submitted ${submittedAt}.`,
        }
    }
  }, [highlightedDeposit])

  const renderStatusBadge = (status: LuckyDrawDepositStatus) => {
    switch (status) {
      case "APPROVED":
        return <Badge className="bg-emerald-500/15 text-emerald-500">Approved</Badge>
      case "REJECTED":
        return <Badge className="bg-rose-500/15 text-rose-500">Rejected</Badge>
      default:
        return <Badge className="bg-amber-500/15 text-amber-500">Pending Review</Badge>
    }
  }

  return (
    <Card
      id="lucky-draw"
      className="dashboard-card relative overflow-hidden border-0 bg-gradient-to-br from-amber-500/10 via-rose-500/10 to-purple-500/10 shadow-lg backdrop-blur"
    >
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.1),_transparent_60%)]"
        aria-hidden
      />
      <CardHeader className="relative z-10 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-semibold text-foreground">BLIND BOX LUCKY DRAW</CardTitle>
            <p className="text-sm text-muted-foreground">Win exciting prizes every 3 days.</p>
          </div>
          <Gift className="h-10 w-10 text-amber-500" />
        </div>
        <div className="rounded-xl bg-white/40 p-4 shadow-inner">
          <p className="text-sm font-medium text-foreground">
            Pay <span className="font-semibold text-amber-600">${REQUIRED_AMOUNT.toFixed(2)}</span> to join the game and the lucky
            draw to win
            <span className="font-semibold"> {activeRound.prizePoolUsd.toFixed(2)}</span>.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Submit your transaction hash and receipt after depositing to Mintmine Pro’s wallet.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            The admin can lock in the winner at any point, but the official announcement (and prize credit) only happens when the
            72-hour countdown ends. Deposits are accepted until the reveal.
          </p>
        </div>
      </CardHeader>
      <CardContent className="relative z-10 space-y-6">
        {isAnnouncementPending ? (
          <Alert className="border-white/40 bg-white/70 text-foreground">
            <AlertTitle>Winner selected — awaiting reveal</AlertTitle>
            <AlertDescription>
              The Blind Box winner has been locked in by the admin. The official announcement is scheduled for
              {" "}
              {format(announcementDate, "MMM d, yyyy • HH:mm 'UTC'")}. {winnerSelectionDate ? (
                <span>
                  Selected {format(winnerSelectionDate, "MMM d, yyyy • HH:mm 'UTC'")}.
                </span>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
        {statusAlert ? (
          <Alert variant={statusAlert.variant} className="border-white/40 bg-white/70 text-foreground">
            <AlertTitle>{statusAlert.title}</AlertTitle>
            <AlertDescription>{statusAlert.description}</AlertDescription>
          </Alert>
        ) : null}
        {roundError ? (
          <Alert variant="destructive" className="border-white/40 bg-rose-500/10">
            <AlertTitle>Unable to load round details</AlertTitle>
            <AlertDescription>{roundError}</AlertDescription>
          </Alert>
        ) : null}

        {depositsError ? (
          <Alert variant="destructive" className="border-white/40 bg-rose-500/10">
            <AlertTitle>Unable to load deposit status</AlertTitle>
            <AlertDescription>{depositsError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          <SummaryTile
            icon={<Timer className="h-5 w-5" />}
            label="Winner announcement"
            value={countdown}
            helper={`Reveal scheduled for ${format(announcementDate, "MMM d, yyyy • HH:mm:ss 'UTC'")}`}
          />
          <SummaryTile
            icon={<History className="h-5 w-5" />}
            label="Total Entries"
            value={`${approvedEntries} participant${approvedEntries === 1 ? "" : "s"}`}
            helper="Automatically counts approved deposits"
          />
          <SummaryTile
            icon={<CalendarDays className="h-5 w-5" />}
            label="Round Window"
            value={`${format(roundStartDate, "MMM d, HH:mm 'UTC'")} → ${format(announcementDate, "MMM d, HH:mm 'UTC'")}`}
            helper="72-hour cadence"
          />
        </div>

          <div className="flex flex-wrap items-center gap-3">
            <Badge className="bg-emerald-500/15 text-emerald-600">
              Prize Pool ${activeRound.prizePoolUsd.toFixed(2)}
            </Badge>
            <Badge className="bg-blue-500/10 text-blue-600">Join with a $10 BEP20 deposit</Badge>
            <span className="text-sm text-muted-foreground">No internal credits allowed.</span>
          </div>

        <div className="flex flex-wrap items-center gap-3">
          {hasApprovedPurchase ? (
            <Button
              size="lg"
              disabled
              className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15"
            >
              Purchased
            </Button>
          ) : (
            <Button
              size="lg"
              disabled={depositsLoading || roundLoading}
              onClick={() => setDepositModalOpen(true)}
            >
              Play Now / Buy for ${REQUIRED_AMOUNT.toFixed(2)}
            </Button>
          )}
          <Button variant="outline" className="backdrop-blur" size="lg">
            View Leaderboard
          </Button>
          <div className="text-sm text-muted-foreground">
            {approvedEntries} participant{approvedEntries === 1 ? " has" : "s have"} joined. {" "}
            {hasApprovedPurchase ? "You have already purchased." : "You can still join until the countdown ends."}
          </div>
        </div>

        <div className="rounded-xl border border-white/40 bg-white/50 p-4 shadow-inner">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">Last winner</p>
            <Badge variant="outline" className="border-emerald-400/50 text-emerald-600">
              Credited automatically
            </Badge>
          </div>
          <p className="mt-2 text-sm text-foreground">
            {latestWinner
              ? `${latestWinner.name} — announced ${format(new Date(latestWinner.announcedAt), "MMM d, yyyy")}`
              : "Winner will appear here once announced."}
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground">Your deposit reviews</h3>
              <p className="text-xs text-muted-foreground">Keep an eye on the status of your submissions.</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={refreshDeposits}
              disabled={depositsLoading}
            >
              <RefreshCw className={`h-3 w-3 ${depositsLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
          <div className="space-y-2">
            {depositsLoading ? (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-white/40 bg-white/60 p-3 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" /> Loading your deposit history…
              </div>
            ) : deposits.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No deposits submitted yet. Submit your $10 deposit to join this round.
              </p>
            ) : (
              deposits.map((deposit) => (
                <div
                  key={deposit.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/50 bg-white/70 p-3 text-sm shadow-sm"
                >
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">
                      ${deposit.amountUsd.toFixed(2)} • {deposit.network ?? "Network"}
                    </p>
                    <p className="break-all font-mono text-xs text-muted-foreground">
                      {deposit.txHash || "Transaction hash pending"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {format(new Date(deposit.submittedAt), "MMM d, yyyy • HH:mm 'UTC'")}
                    </p>
                    {deposit.receipt?.url ? (
                      <a
                        className="text-xs font-medium text-blue-600 hover:underline"
                        href={deposit.receipt.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View receipt
                      </a>
                    ) : deposit.receiptReference ? (
                      <p className="break-all text-xs text-blue-600">{deposit.receiptReference}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-1 text-right">
                    {renderStatusBadge(deposit.status)}
                    {deposit.adminNote && deposit.status === "REJECTED" ? (
                      <p className="max-w-[16rem] text-xs text-rose-500">Note: {deposit.adminNote}</p>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
      <LuckyDrawDepositModal
        open={depositModalOpen}
        onOpenChange={setDepositModalOpen}
        onSuccess={handleDepositSuccess}
      />
    </Card>
  )
}

function SummaryTile({
  icon,
  label,
  value,
  helper,
}: {
  icon: ReactNode
  label: string
  value: string
  helper: string
}) {
  return (
    <div className="rounded-xl border border-white/40 bg-white/60 p-4 shadow-sm">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="rounded-lg bg-white/70 p-2 text-amber-500">{icon}</span>
        <span className="font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-3 text-xl font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{helper}</p>
    </div>
  )
}

function formatRemaining(nextDrawDate: Date) {
  const now = new Date()
  const totalSeconds = Math.max(0, differenceInSeconds(nextDrawDate, now))

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const formatted = [hours, minutes, seconds].map((part) => part.toString().padStart(2, "0")).join(":")

  return totalSeconds === 0 ? "Drawing now" : formatted
}
