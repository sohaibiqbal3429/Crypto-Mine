"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Copy, ExternalLink } from "lucide-react"

interface RoundUserState {
  pendingTransactionId?: string | null
  pendingStatus?: "pending" | "rejected"
  pendingReason?: string | null
  approvedEntries?: number
  totalInvested?: number
}

interface RoundData {
  roundId: string
  status: string
  index: number
  prizePool: number
  totalEntries: number
  participantsCount: number
  startsAt: string
  endsAt: string
  countdownSeconds: number
  network: string
  address: string
  entryValue: number
  allowMultiples: boolean
  minDeposit: number
  currentWinner?: {
    userId: string
    entriesAtWin: number
    payoutStatus: string
    selectedAt: string
    selectedBy: "random" | "manual"
  }
  lastWinner?: {
    roundIndex: number
    userId: string
    entriesAtWin: number
    payoutStatus: string
    declaredAt: string
  }
  user?: RoundUserState
}

interface AuthUserResponse {
  user?: {
    referralCode?: string
    name?: string
  }
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
}

function formatUTC(value: string) {
  return new Date(value).toLocaleString("en-US", { timeZone: "UTC", hour12: false }) + " UTC"
}

function formatCountdown(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const days = Math.floor(seconds / (24 * 3600))
  const hours = Math.floor((seconds % (24 * 3600)) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return { days, hours, minutes, seconds: secs }
}

export function HomeClient() {
  const [round, setRound] = useState<RoundData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [amount, setAmount] = useState<number>(10)
  const [txHash, setTxHash] = useState("")
  const [receipt, setReceipt] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [countdownSeconds, setCountdownSeconds] = useState(0)
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [formError, setFormError] = useState("")
  const [confirmed, setConfirmed] = useState(false)

  const { toast } = useToast()

  const fetchRound = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/giftbox/current-round")
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || "Unable to load blind box")
      }
      const payload = (await response.json()) as { round: RoundData }
      setRound(payload.round)
      setAmount(payload.round.entryValue)
      setCountdownSeconds(payload.round.countdownSeconds)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unable to load blind box")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRound().catch(() => null)
    fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: AuthUserResponse | null) => {
        if (data?.user?.referralCode) {
          setReferralCode(data.user.referralCode)
        }
      })
      .catch(() => null)
  }, [fetchRound])

  useEffect(() => {
    if (!round) return
    const interval = setInterval(() => {
      setCountdownSeconds((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [round])

  useEffect(() => {
    if (!isModalOpen) {
      setFormError("")
      setTxHash("")
      setReceipt(null)
      setConfirmed(false)
    }
  }, [isModalOpen])

  const countdown = useMemo(() => formatCountdown(countdownSeconds), [countdownSeconds])
  const qrCodeUrl = useMemo(() => {
    if (!round?.address) return ""
    return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(round.address)}`
  }, [round?.address])

  const handleAmountChange = useCallback(
    (value: string) => {
      const parsed = Number(value)
      if (Number.isNaN(parsed)) {
        setAmount(round?.entryValue ?? 10)
        return
      }
      setAmount(parsed)
    },
    [round?.entryValue],
  )

  const entries = useMemo(() => {
    if (!round) return 0
    if (!round.allowMultiples) return amount >= round.entryValue ? 1 : 0
    return Math.floor(amount / round.entryValue)
  }, [amount, round])

  const statusMessage = useMemo(() => {
    if (!round?.user) return null
    if (round.user.pendingStatus === "pending") {
      return { variant: "warning" as const, message: "Awaiting admin review…" }
    }
    if (round.user.pendingStatus === "rejected") {
      return {
        variant: "error" as const,
        message: round.user.pendingReason ? `Rejected: ${round.user.pendingReason}` : "Your last submission was rejected.",
      }
    }
    if ((round.user.approvedEntries ?? 0) > 0) {
      return {
        variant: "success" as const,
        message: `Your ${formatCurrency(round.user.totalInvested ?? round.entryValue)} deposit is active in this round.`,
      }
    }
    return null
  }, [entries, round])

  const handleCopy = useCallback(() => {
    if (!round?.address) return
    navigator.clipboard.writeText(round.address).then(() => {
      toast({ description: "Deposit address copied." })
    })
  }, [round?.address, toast])

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!round) return
      if (!txHash.trim()) {
        setFormError("Transaction hash is required.")
        return
      }
      if (!receipt) {
        setFormError("Please upload a receipt (image or PDF).")
        return
      }
      if (entries < 1) {
        setFormError(`Minimum amount is ${formatCurrency(round.entryValue)}.`)
        return
      }
      if (!confirmed) {
        setFormError("Please confirm that you sent the deposit.")
        return
      }

      const formData = new FormData()
      formData.set("amount", String(amount))
      formData.set("network", round.network)
      formData.set("address", round.address)
      formData.set("txHash", txHash.trim())
      formData.set("receipt", receipt)

      setSubmitting(true)
      setFormError("")
      try {
        const response = await fetch("/api/giftbox/deposit", {
          method: "POST",
          body: formData,
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(payload.error || "Unable to submit deposit")
        }
        toast({ description: "Your deposit review has been submitted successfully." })
        setIsModalOpen(false)
        setTxHash("")
        setReceipt(null)
        setConfirmed(false)
        await fetchRound()
      } catch (err) {
        console.error(err)
        setFormError(err instanceof Error ? err.message : "Unable to submit deposit")
      } finally {
        setSubmitting(false)
      }
    },
    [amount, entries, fetchRound, receipt, round, toast, txHash],
  )

  const playButtonLabel = useMemo(() => {
    if (!round) return "Play Now"
    return entries > 1 ? `Buy ${entries} entries` : `Buy for ${formatCurrency(round.entryValue)}`
  }, [entries, round])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f9fafc] via-[#eef5ff] to-[#f1f5f9] text-foreground dark:from-[#050505] dark:via-[#0c0c0c] dark:to-[#111827]">
      <header className="border-b border-white/50 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50 dark:border-white/10 dark:bg-black/50">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center space-x-3">
            <Image src="/images/logo.png" alt="Mintmine Pro" width={40} height={40} className="rounded-xl" />
            <span className="text-2xl font-bold">Mintmine Pro</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/auth/register">
              <Button className="shadow-lg shadow-primary/30">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 pb-16 pt-12">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-balance text-5xl font-bold leading-tight sm:text-6xl">
            Win exclusive prizes every
            <span className="bg-gradient-to-r from-primary via-accent to-primary/80 bg-clip-text text-transparent"> 3 days</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground sm:text-xl">
            Deposit $10 in BSC (BEP20) to enter the Mintmine Pro Blind Box Lucky Draw. Every entry boosts the prize pool!
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button size="lg" className="px-8 text-lg" onClick={() => setIsModalOpen(true)} disabled={loading}>
              Play Now
            </Button>
            <Link href="/transactions">
              <Button size="lg" variant="outline" className="px-8 text-lg">
                View Leaderboard
              </Button>
            </Link>
          </div>
          {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#ff7a7a] via-[#f857a6] to-[#5b5bfc] p-[1px] shadow-xl">
            <div className="h-full w-full rounded-[calc(1.5rem-1px)] bg-white/95 p-6 dark:bg-black/60">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-[#f43f5e] dark:text-pink-300">Blind Box Lucky Draw</h2>
                  <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                    Pay {round ? formatCurrency(round.entryValue) : "$10.00"} to join the game and let the lucky draw win {round ? formatCurrency(round.prizePool) : "$0"}.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button onClick={() => setIsModalOpen(true)} disabled={loading} className="gap-2">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {playButtonLabel}
                    </Button>
                    <Button variant="outline" onClick={() => fetchRound()} disabled={loading} className="gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" hidden={!loading} /> Refresh
                    </Button>
                  </div>
                  {statusMessage ? (
                    <div
                      className={`mt-4 w-full rounded-xl border px-4 py-3 text-sm ${
                        statusMessage.variant === "success"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : statusMessage.variant === "warning"
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-rose-200 bg-rose-50 text-rose-700"
                      }`}
                    >
                      {statusMessage.message}
                    </div>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="text-sm uppercase text-muted-foreground">Round #{round?.index ?? "—"}</p>
                  <p className="text-3xl font-semibold">{formatCurrency(round?.prizePool ?? 0)}</p>
                  <p className="text-xs text-muted-foreground">Prize pool</p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatBubble title="Participants" value={round?.participantsCount ?? 0} />
                <StatBubble title="Total entries" value={round?.totalEntries ?? 0} />
                <StatBubble title="Round window" value={round ? `${formatUTC(round.startsAt)} → ${formatUTC(round.endsAt)}` : "—"} small />
                <StatBubble
                  title="Next draw"
                  value={`${countdown.days}d ${countdown.hours}h ${countdown.minutes}m ${countdown.seconds}s`}
                  small
                />
              </div>

              {round?.currentWinner ? (
                <div className="mt-6 rounded-2xl border border-white/60 bg-white/70 p-4 text-sm shadow-inner dark:border-white/10 dark:bg-white/5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-primary">Winner pending payout</span>
                    <Badge variant="outline">{round.currentWinner.payoutStatus}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    User {round.currentWinner.userId} • {round.currentWinner.entriesAtWin} entries • Declared {formatUTC(round.currentWinner.selectedAt)}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <Card className="relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-[#e0f2ff] via-[#e8f7ff] to-white p-6 text-left shadow-xl dark:border-blue-900/40 dark:from-[#0f172a] dark:via-[#172554] dark:to-[#020617]">
            <CardContent className="space-y-6 p-0">
              <div>
                <h3 className="text-lg font-semibold text-sky-700 dark:text-sky-200">Invite & Earn</h3>
                <p className="mt-2 text-sm text-sky-800/80 dark:text-sky-100">
                  Earn 10% of your friends’ daily mining rewards when they join with your referral link.
                </p>
              </div>
              <div className="rounded-2xl bg-white/70 p-4 shadow-inner dark:bg-white/10">
                <p className="text-xs uppercase text-muted-foreground">Your referral code</p>
                <p className="mt-1 text-2xl font-semibold tracking-wide">
                  {referralCode ?? "Sign in to view"}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (!referralCode) return
                      const link = `${window.location.origin}/auth/register?ref=${referralCode}`
                      navigator.clipboard.writeText(link).then(() => toast({ description: "Referral link copied." }))
                    }}
                    disabled={!referralCode}
                    className="gap-2"
                  >
                    <Copy className="h-4 w-4" /> Copy referral link
                  </Button>
                  <Link href="/team">
                    <Button variant="outline" size="sm" className="gap-2">
                      <ExternalLink className="h-4 w-4" /> Share & Invite
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="rounded-2xl border border-sky-100 bg-white/80 p-4 text-sm text-sky-900/80 dark:border-sky-900/40 dark:bg-sky-950/40 dark:text-sky-100">
                <p className="font-semibold">How it works</p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  <li>Share your referral link with friends and communities.</li>
                  <li>Earn 10% of their daily mining rewards automatically.</li>
                  <li>Unlock bonus Blind Box entries for top referrers.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-[min(900px,95vw)] max-w-none rounded-3xl border border-primary/10 bg-white/95 p-6 shadow-2xl dark:bg-slate-950/95">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">Join the Lucky Draw</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold">Deposit amount (USD)</Label>
                <Input
                  type="number"
                  value={amount}
                  min={round?.entryValue ?? 10}
                  step={round?.entryValue ?? 10}
                  onChange={(event) => handleAmountChange(event.target.value)}
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {round?.allowMultiples
                    ? `Each ${formatCurrency(round?.entryValue ?? 10)} equals one entry. You currently have ${entries} entries.`
                    : `Fixed entry of ${formatCurrency(round?.entryValue ?? 10)}.`}
                </p>
              </div>
              <div>
                <Label className="text-sm font-semibold">Transaction hash (TXID)</Label>
                <Input value={txHash} onChange={(event) => setTxHash(event.target.value)} placeholder="0x..." required />
              </div>
              <div>
                <Label className="text-sm font-semibold">Receipt upload</Label>
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                  onChange={(event) => setReceipt(event.target.files?.[0] ?? null)}
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">Upload exchange screenshot or PDF confirmation.</p>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-muted bg-muted/30 p-3">
                <Checkbox id="confirm" checked={confirmed} onCheckedChange={(value) => setConfirmed(Boolean(value))} />
                <Label htmlFor="confirm" className="text-sm">
                  I sent ${formatCurrency(round?.entryValue ?? 10)} to the BEP20 address above.
                </Label>
              </div>
              {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4">
                <p className="text-xs uppercase text-muted-foreground">Send exactly</p>
                <p className="mt-1 text-xl font-semibold">{formatCurrency(round?.entryValue ?? 10)} (BEP20)</p>
                <p className="mt-3 text-xs uppercase text-muted-foreground">Deposit address</p>
                <div className="mt-1 flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2 font-mono text-xs shadow-inner dark:bg-white/5">
                  <span className="line-clamp-2">{round?.address ?? "Bep20"}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={handleCopy}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                {qrCodeUrl ? (
                  <div className="mt-4 flex justify-center">
                    <img
                      src={qrCodeUrl}
                      alt="Deposit QR code"
                      width={160}
                      height={160}
                      className="rounded-xl border border-primary/20"
                    />
                  </div>
                ) : null}
              </div>
              <div className="rounded-2xl border border-muted bg-muted/40 p-4 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">Network requirements</p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  <li>Network: {round?.network ?? "BEP20 (BSC)"}</li>
                  <li>Minimum amount: {formatCurrency(round?.minDeposit ?? 10)}</li>
                  <li>Entries credited after admin approval.</li>
                </ul>
                <p className="mt-3 text-[11px]">By submitting, you confirm the transaction to the BEP20 address above.</p>
              </div>
              <Button type="submit" disabled={submitting} className="w-full gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Submit for review
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatBubble({ title, value, small = false }: { title: string; value: string | number; small?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-inner dark:border-white/10 dark:bg-white/5">
      <p className="text-xs uppercase text-muted-foreground">{title}</p>
      <p className={`mt-2 font-semibold ${small ? "text-sm" : "text-xl"}`}>{value}</p>
    </div>
  )
}
