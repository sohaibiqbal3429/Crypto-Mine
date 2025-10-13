"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Loader2, Lock, Play, RefreshCw, ShieldCheck, Trophy, UserMinus } from "lucide-react"

interface GiftBoxParticipantTransaction {
  entryId: string
  transactionId: string
  amount: number
  entries: number
  txHash: string
  approvedAt: string
}

interface GiftBoxParticipant {
  userId: string
  email: string
  entries: number
  transactions: GiftBoxParticipantTransaction[]
}

interface GiftBoxOverviewResponse {
  overview: {
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
    lastWinner?: {
      roundIndex: number
      userId: string
      entriesAtWin: number
      payoutStatus: string
      declaredAt: string
    }
    currentWinner?: {
      userId: string
      entriesAtWin: number
      payoutStatus: string
      selectedAt: string
      selectedBy: "random" | "manual"
    }
    user?: unknown
  }
  settings: {
    roundDurationHours: number
    minDeposit: number
    entryValue: number
    allowMultiples: boolean
    network: string
    address: string
    prizePoolPercent: number
  }
  participants: GiftBoxParticipant[]
  bans: Array<{ userId: string; address?: string; reason?: string }>
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-emerald-100 text-emerald-700",
  locked: "bg-amber-100 text-amber-700",
  drawing: "bg-blue-100 text-blue-700",
  closed: "bg-slate-200 text-slate-700",
}

function formatUSD(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", { timeZone: "UTC", hour12: false }) + " UTC"
}

interface CountdownState {
  days: number
  hours: number
  minutes: number
  seconds: number
}

function computeCountdown(seconds: number): CountdownState {
  const total = Math.max(0, seconds)
  const days = Math.floor(total / (24 * 3600))
  const hours = Math.floor((total % (24 * 3600)) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  return { days, hours, minutes, seconds: secs }
}

export function GiftboxControlPanel() {
  const [data, setData] = useState<GiftBoxOverviewResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [countdown, setCountdown] = useState<CountdownState>(() => computeCountdown(0))
  const [selectedParticipant, setSelectedParticipant] = useState<string>("")
  const [banUserId, setBanUserId] = useState<string>("")
  const [banReason, setBanReason] = useState("")
  const [banAddress, setBanAddress] = useState("")
  const [settingsDraft, setSettingsDraft] = useState({
    roundDurationHours: "",
    minDeposit: "",
    entryValue: "",
    prizePoolPercent: "",
    network: "",
    address: "",
    allowMultiples: "true",
  })

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/giftbox/overview")
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || "Unable to load control panel")
      }
      const payload = (await response.json()) as GiftBoxOverviewResponse
      setData(payload)
      setCountdown(computeCountdown(payload.overview.countdownSeconds))
      setSettingsDraft({
        roundDurationHours: String(payload.settings.roundDurationHours),
        minDeposit: String(payload.settings.minDeposit),
        entryValue: String(payload.settings.entryValue),
        prizePoolPercent: String(payload.settings.prizePoolPercent),
        network: payload.settings.network,
        address: payload.settings.address,
        allowMultiples: String(payload.settings.allowMultiples),
      })
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unable to load control panel")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh().catch(() => null)
  }, [refresh])

  useEffect(() => {
    if (!data) return
    const interval = setInterval(() => {
      setCountdown((prev) => {
        const total = Math.max(0, (prev.days * 24 * 3600 + prev.hours * 3600 + prev.minutes * 60 + prev.seconds) - 1)
        return computeCountdown(total)
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [data])

  const handleRoundAction = useCallback(
    async (action: "open" | "lock" | "close") => {
      setSubmitting(true)
      try {
        const response = await fetch(`/api/admin/giftbox/rounds/${action}`, { method: "POST" })
        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(body.error || `Unable to ${action} round`)
        }
        await refresh()
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : `Unable to ${action} round`)
      } finally {
        setSubmitting(false)
      }
    },
    [refresh],
  )

  const handleRandomWinner = useCallback(async () => {
    if (!data) return
    setSubmitting(true)
    try {
      const response = await fetch(`/api/admin/giftbox/rounds/${data.overview.roundId}/winner/random`, { method: "POST" })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || "Unable to select random winner")
      }
      await refresh()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unable to select winner")
    } finally {
      setSubmitting(false)
    }
  }, [data, refresh])

  const handleManualWinner = useCallback(async () => {
    if (!data || !selectedParticipant) return
    setSubmitting(true)
    try {
      const response = await fetch(`/api/admin/giftbox/rounds/${data.overview.roundId}/winner/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedParticipant }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || "Unable to set winner")
      }
      setSelectedParticipant("")
      await refresh()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unable to set winner")
    } finally {
      setSubmitting(false)
    }
  }, [data, refresh, selectedParticipant])

  const handleMarkPaid = useCallback(async () => {
    if (!data) return
    setSubmitting(true)
    try {
      const response = await fetch(`/api/admin/giftbox/rounds/${data.overview.roundId}/mark-paid`, { method: "POST" })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || "Unable to mark payout as paid")
      }
      await refresh()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unable to mark payout as paid")
    } finally {
      setSubmitting(false)
    }
  }, [data, refresh])

  const handleVoidEntry = useCallback(
    async (entryId: string) => {
      setSubmitting(true)
      try {
        const response = await fetch(`/api/admin/giftbox/entries/${entryId}/void`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Voided by admin" }),
        })
        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(body.error || "Unable to void entry")
        }
        await refresh()
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : "Unable to void entry")
      } finally {
        setSubmitting(false)
      }
    },
    [refresh],
  )

  const handleBan = useCallback(async () => {
    if (!banUserId) return
    setSubmitting(true)
    try {
      const response = await fetch("/api/admin/giftbox/bans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: banUserId, reason: banReason, address: banAddress }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || "Unable to ban user")
      }
      setBanUserId("")
      setBanReason("")
      setBanAddress("")
      await refresh()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unable to ban user")
    } finally {
      setSubmitting(false)
    }
  }, [banAddress, banReason, banUserId, refresh])

  const handleUnban = useCallback(
    async (userId: string) => {
      setSubmitting(true)
      try {
        const response = await fetch(`/api/admin/giftbox/bans/${userId}`, { method: "DELETE" })
        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(body.error || "Unable to unban user")
        }
        await refresh()
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : "Unable to unban user")
      } finally {
        setSubmitting(false)
      }
    },
    [refresh],
  )

  const handleSettingsSave = useCallback(async () => {
    setSubmitting(true)
    try {
      const response = await fetch("/api/admin/giftbox/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundDurationHours: Number(settingsDraft.roundDurationHours),
          minDeposit: Number(settingsDraft.minDeposit),
          entryValue: Number(settingsDraft.entryValue),
          prizePoolPercent: Number(settingsDraft.prizePoolPercent),
          network: settingsDraft.network,
          address: settingsDraft.address,
          allowMultiples: settingsDraft.allowMultiples === "true",
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || "Unable to update settings")
      }
      await refresh()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Unable to update settings")
    } finally {
      setSubmitting(false)
    }
  }, [refresh, settingsDraft])

  const handleExport = useCallback(() => {
    if (!data) return
    const rows = [
      ["User ID", "Email", "Entries", "Transaction ID", "Amount", "Entries per TX", "TX Hash", "Approved At"],
    ]
    data.participants.forEach((participant) => {
      participant.transactions.forEach((tx) => {
        rows.push([
          participant.userId,
          participant.email,
          String(participant.entries),
          tx.transactionId,
          tx.amount.toFixed(2),
          String(tx.entries),
          tx.txHash,
          tx.approvedAt,
        ])
      })
    })
    const csv = rows
      .map((row) =>
        row
          .map((cell) => {
            const text = String(cell ?? "")
            return `"${text.replace(/"/g, '""')}"`
          })
          .join(","),
      )
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `blind-box-participants-${Date.now()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [data])

  const statusBadgeClass = useMemo(() => {
    const status = data?.overview.status ?? "open"
    return STATUS_COLORS[status] ?? "bg-slate-200 text-slate-700"
  }, [data?.overview.status])

  if (!data) {
    return (
      <Card className="mt-6">
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="text-2xl font-semibold">Blind Box Control Panel</CardTitle>
          <Button variant="secondary" onClick={refresh} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
          <p className="text-sm text-muted-foreground">Loading blind box data...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-2xl font-semibold">Blind Box Control Panel</CardTitle>
            <p className="text-sm text-muted-foreground">Manage the lucky draw rounds, winners, and safety controls.</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={`uppercase ${statusBadgeClass}`}>
              {data.overview.status} — Round #{data.overview.index}
            </Badge>
            <Button variant="secondary" onClick={refresh} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4">
              <p className="text-xs uppercase text-muted-foreground">Prize pool</p>
              <p className="mt-2 text-2xl font-semibold">{formatUSD(data.overview.prizePool)}</p>
            </div>
            <div className="rounded-2xl border bg-muted/30 p-4">
              <p className="text-xs uppercase text-muted-foreground">Total entries</p>
              <p className="mt-2 text-2xl font-semibold">{data.overview.totalEntries}</p>
            </div>
            <div className="rounded-2xl border bg-muted/30 p-4">
              <p className="text-xs uppercase text-muted-foreground">Participants</p>
              <p className="mt-2 text-2xl font-semibold">{data.overview.participantsCount}</p>
            </div>
            <div className="rounded-2xl border bg-gradient-to-br from-accent/10 via-accent/5 to-transparent p-4">
              <p className="text-xs uppercase text-muted-foreground">Next draw (UTC)</p>
              <p className="mt-2 text-sm font-medium">{formatDate(data.overview.endsAt)}</p>
              <p className="text-xs text-muted-foreground">
                {countdown.days}d {countdown.hours}h {countdown.minutes}m {countdown.seconds}s
              </p>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => handleRoundAction("lock")}
                  variant="outline"
                  disabled={submitting || data.overview.status !== "open"}
                  className="gap-2"
                >
                  <Lock className="h-4 w-4" /> Lock entries
                </Button>
                <Button
                  onClick={handleRandomWinner}
                  variant="default"
                  disabled={submitting || (data.overview.status !== "locked" && data.overview.status !== "drawing")}
                  className="gap-2"
                >
                  <Trophy className="h-4 w-4" /> Draw random winner
                </Button>
                <Button
                  onClick={() => handleRoundAction("close")}
                  variant="outline"
                  disabled={submitting || data.overview.status !== "drawing" || !data.overview.currentWinner}
                  className="gap-2"
                >
                  <ShieldCheck className="h-4 w-4" /> Close round
                </Button>
                <Button
                  onClick={() => handleRoundAction("open")}
                  variant="outline"
                  disabled={submitting || data.overview.status !== "closed"}
                  className="gap-2"
                >
                  <Play className="h-4 w-4" /> Start new round
                </Button>
              </div>

              <div className="rounded-xl border p-4">
                <h3 className="text-lg font-semibold">Manual winner selection</h3>
                <p className="text-sm text-muted-foreground">Choose a participant to declare as the winner.</p>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                  <Select value={selectedParticipant} onValueChange={setSelectedParticipant}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select participant" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.participants.map((participant) => (
                        <SelectItem key={participant.userId} value={participant.userId}>
                          {participant.email || participant.userId} — {participant.entries} entries
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleManualWinner} disabled={!selectedParticipant || submitting} className="h-11">
                    Confirm winner
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h3 className="text-lg font-semibold">Participants ({data.participants.length})</h3>
                  <Button variant="secondary" size="sm" onClick={handleExport} className="gap-2">
                    <RefreshCw className="h-4 w-4" /> Export CSV
                  </Button>
                </div>
                <ScrollArea className="h-[320px]">
                  <div className="divide-y">
                    {data.participants.map((participant) => (
                      <div key={participant.userId} className="space-y-2 px-4 py-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold">{participant.email || participant.userId}</p>
                            <p className="text-xs text-muted-foreground">{participant.userId}</p>
                          </div>
                          <Badge variant="outline">{participant.entries} entries</Badge>
                        </div>
                        <div className="space-y-2 rounded-md border bg-muted/40 p-3">
                          {participant.transactions.map((transaction) => (
                            <div key={transaction.entryId} className="flex flex-col gap-1 rounded bg-background p-2 text-xs">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-medium">{formatUSD(transaction.amount)}</span>
                                <span>{transaction.entries} entries</span>
                              </div>
                              <span className="font-mono text-[11px] text-muted-foreground">{transaction.txHash}</span>
                              <span className="text-[11px] text-muted-foreground">Approved {formatDate(transaction.approvedAt)}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleVoidEntry(transaction.entryId)}
                                disabled={submitting}
                                className="self-start text-destructive"
                              >
                                <UserMinus className="mr-1 h-3 w-3" /> Void entry
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border p-4">
                <h3 className="text-lg font-semibold">Winner & payout</h3>
                {data.overview.currentWinner ? (
                  <div className="mt-3 space-y-2 text-sm">
                    <p>Current round winner</p>
                    <p>User ID: <span className="font-mono text-xs">{data.overview.currentWinner.userId}</span></p>
                    <p>Entries at win: {data.overview.currentWinner.entriesAtWin}</p>
                    <p>Selected via: {data.overview.currentWinner.selectedBy}</p>
                    <p>Status: <Badge variant="secondary">{data.overview.currentWinner.payoutStatus}</Badge></p>
                    <p>Declared at: {formatDate(data.overview.currentWinner.selectedAt)}</p>
                    <Button
                      onClick={handleMarkPaid}
                      disabled={submitting || data.overview.currentWinner.payoutStatus === "paid"}
                      className="mt-2 w-full"
                    >
                      Mark as paid
                    </Button>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">No winner selected yet.</p>
                )}
                {data.overview.lastWinner ? (
                  <div className="mt-4 rounded-md border bg-muted/30 p-3 text-xs">
                    <p className="font-semibold">Previous winner</p>
                    <p>Round #{data.overview.lastWinner.roundIndex}</p>
                    <p>User ID: <span className="font-mono text-[11px]">{data.overview.lastWinner.userId}</span></p>
                    <p>Payout status: {data.overview.lastWinner.payoutStatus}</p>
                    <p>Declared: {formatDate(data.overview.lastWinner.declaredAt)}</p>
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border p-4 space-y-3">
                <h3 className="text-lg font-semibold">Ban participants</h3>
                <div className="grid gap-2 text-sm">
                  <Label htmlFor="ban-user">User ID</Label>
                  <Input id="ban-user" value={banUserId} onChange={(event) => setBanUserId(event.target.value)} placeholder="64f..." />
                </div>
                <div className="grid gap-2 text-sm">
                  <Label htmlFor="ban-address">Address (optional)</Label>
                  <Input id="ban-address" value={banAddress} onChange={(event) => setBanAddress(event.target.value)} placeholder="Wallet or identifier" />
                </div>
                <div className="grid gap-2 text-sm">
                  <Label htmlFor="ban-reason">Reason</Label>
                  <Textarea id="ban-reason" value={banReason} onChange={(event) => setBanReason(event.target.value)} rows={2} />
                </div>
                <Button onClick={handleBan} disabled={submitting || !banUserId} className="w-full">
                  Ban user
                </Button>
                {data.bans.length ? (
                  <div className="rounded-md border bg-muted/30 p-3 text-xs">
                    <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Banned list</p>
                    <div className="space-y-2">
                      {data.bans.map((ban) => (
                        <div key={ban.userId} className="flex flex-wrap items-center justify-between gap-2 rounded bg-background p-2">
                          <div>
                            <p className="font-mono text-[11px]">{ban.userId}</p>
                            {ban.reason ? <p className="text-[11px] text-muted-foreground">{ban.reason}</p> : null}
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => handleUnban(ban.userId)} disabled={submitting}>
                            Unban
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border p-4 space-y-3">
                <h3 className="text-lg font-semibold">Round settings</h3>
                <div className="grid gap-2 text-sm">
                  <Label htmlFor="duration">Duration (hours)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={settingsDraft.roundDurationHours}
                    onChange={(event) => setSettingsDraft((prev) => ({ ...prev, roundDurationHours: event.target.value }))}
                  />
                </div>
                <div className="grid gap-2 text-sm">
                  <Label htmlFor="min-deposit">Minimum deposit</Label>
                  <Input
                    id="min-deposit"
                    type="number"
                    value={settingsDraft.minDeposit}
                    onChange={(event) => setSettingsDraft((prev) => ({ ...prev, minDeposit: event.target.value }))}
                  />
                </div>
                <div className="grid gap-2 text-sm">
                  <Label htmlFor="entry-value">Entry value</Label>
                  <Input
                    id="entry-value"
                    type="number"
                    value={settingsDraft.entryValue}
                    onChange={(event) => setSettingsDraft((prev) => ({ ...prev, entryValue: event.target.value }))}
                  />
                </div>
                <div className="grid gap-2 text-sm">
                  <Label htmlFor="prize-pct">Prize pool %</Label>
                  <Input
                    id="prize-pct"
                    type="number"
                    value={settingsDraft.prizePoolPercent}
                    onChange={(event) => setSettingsDraft((prev) => ({ ...prev, prizePoolPercent: event.target.value }))}
                  />
                </div>
                <div className="grid gap-2 text-sm">
                  <Label htmlFor="network">Network</Label>
                  <Input
                    id="network"
                    value={settingsDraft.network}
                    onChange={(event) => setSettingsDraft((prev) => ({ ...prev, network: event.target.value }))}
                  />
                </div>
                <div className="grid gap-2 text-sm">
                  <Label htmlFor="address">Deposit address</Label>
                  <Textarea
                    id="address"
                    rows={2}
                    value={settingsDraft.address}
                    onChange={(event) => setSettingsDraft((prev) => ({ ...prev, address: event.target.value }))}
                  />
                </div>
                <div className="grid gap-2 text-sm">
                  <Label>Allow multiples</Label>
                  <Select
                    value={settingsDraft.allowMultiples}
                    onValueChange={(value) => setSettingsDraft((prev) => ({ ...prev, allowMultiples: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Allow multiples</SelectItem>
                      <SelectItem value="false">Single entry only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleSettingsSave} disabled={submitting} className="w-full">
                  Save settings
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
