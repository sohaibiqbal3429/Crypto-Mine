"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, Loader2, RefreshCw, ShieldCheck, Sparkles, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"

interface AdminLuckyDrawRound {
  id: string
  status: "open" | "closed" | "completed"
  entryFee: number
  prize: number
  startsAt: string
  endsAt: string
  totalEntries: number
  winnerUserId: string | null
  winnerSnapshot: {
    name: string
    referralCode: string
    creditedAt: string | null
  } | null
  payoutTxId: string | null
  completedAt: string | null
}

interface AdminLuckyDrawParticipant {
  _id: string
  user?: {
    _id: string
    name: string
    email: string
    referralCode: string
  }
  joinedAt: string
}

interface AdminLuckyDrawConfig {
  entryFee: number
  prize: number
  cycleHours: number
  autoDrawEnabled: boolean
}

export function LuckyDrawPanel() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [currentRound, setCurrentRound] = useState<AdminLuckyDrawRound | null>(null)
  const [pendingRound, setPendingRound] = useState<AdminLuckyDrawRound | null>(null)
  const [participants, setParticipants] = useState<AdminLuckyDrawParticipant[]>([])
  const [history, setHistory] = useState<AdminLuckyDrawRound[]>([])
  const [settings, setSettings] = useState<AdminLuckyDrawConfig | null>(null)
  const [activeTab, setActiveTab] = useState("current")
  const [settingsDraft, setSettingsDraft] = useState<AdminLuckyDrawConfig>({
    entryFee: 10,
    prize: 30,
    cycleHours: 72,
    autoDrawEnabled: true,
  })

  const fetchCurrent = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/lucky-draw/round/current")
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Unable to load current round")
      }
      const data = await response.json()
      setCurrentRound(data.openRound ?? null)
      setPendingRound(data.pendingClosedRound ?? null)
      setParticipants((data.participants ?? []) as AdminLuckyDrawParticipant[])
      setSettings(data.config ?? null)
    } catch (error: any) {
      console.error("Lucky draw admin current fetch error", error)
      toast({ title: "Unable to load current round", description: error?.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const response = await fetch("/api/admin/lucky-draw/rounds?status=completed&limit=50")
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Unable to load rounds history")
      }
      const data = await response.json()
      setHistory((data.rounds ?? []) as AdminLuckyDrawRound[])
    } catch (error: any) {
      console.error("Lucky draw admin history error", error)
      toast({ title: "Unable to load history", description: error?.message, variant: "destructive" })
    } finally {
      setHistoryLoading(false)
    }
  }, [toast])

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/lucky-draw/settings")
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Unable to load settings")
      }
      const data = await response.json()
      setSettings(data.config as AdminLuckyDrawConfig)
    } catch (error: any) {
      console.error("Lucky draw admin settings error", error)
      toast({ title: "Unable to load settings", description: error?.message, variant: "destructive" })
    }
  }, [toast])

  useEffect(() => {
    fetchCurrent()
    fetchHistory()
    fetchSettings()
  }, [fetchCurrent, fetchHistory, fetchSettings])

  useEffect(() => {
    if (settings) {
      setSettingsDraft(settings)
    }
  }, [settings])

  const activeRound = currentRound ?? pendingRound

  const handleDrawNow = useCallback(async () => {
    const target = pendingRound ?? currentRound
    if (!target) {
      toast({ title: "No round to finalize", variant: "destructive" })
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/admin/lucky-draw/round/${target.id}/draw`, { method: "POST" })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Unable to finalize round")
      }
      toast({ title: "Round finalized", description: "A new round has started." })
      await Promise.all([fetchCurrent(), fetchHistory()])
    } catch (error: any) {
      console.error("Draw now error", error)
      toast({ title: "Unable to finalize round", description: error?.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [currentRound, pendingRound, fetchCurrent, fetchHistory, toast])

  const handleRefund = useCallback(
    async (entryId: string) => {
      const target = activeRound
      if (!target) return
      try {
        setLoading(true)
        const response = await fetch(`/api/admin/lucky-draw/round/${target.id}/refund`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entryId }),
        })
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || "Unable to refund entry")
        }
        toast({ title: "Entry refunded" })
        await fetchCurrent()
      } catch (error: any) {
        console.error("Refund error", error)
        toast({ title: "Unable to refund entry", description: error?.message, variant: "destructive" })
      } finally {
        setLoading(false)
      }
    },
    [activeRound, fetchCurrent, toast],
  )

  const handleExport = useCallback(() => {
    if (!participants.length) {
      toast({ title: "No participants to export", variant: "destructive" })
      return
    }
    const rows = [
      ["User", "Email", "Referral Code", "Joined At"],
      ...participants.map((participant) => [
        participant.user?.name ?? "", 
        participant.user?.email ?? "",
        participant.user?.referralCode ?? "",
        participant.joinedAt,
      ]),
    ]
    const csv = rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `lucky-draw-participants-${Date.now()}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }, [participants, toast])

  const handleSaveSettings = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      try {
        setSettingsSaving(true)
        const response = await fetch("/api/admin/lucky-draw/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settingsDraft),
        })
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || "Unable to save settings")
        }
        const data = await response.json()
        setSettings(data.config as AdminLuckyDrawConfig)
        toast({ title: "Settings updated" })
      } catch (error: any) {
        console.error("Settings save error", error)
        toast({ title: "Unable to save settings", description: error?.message, variant: "destructive" })
      } finally {
        setSettingsSaving(false)
      }
    },
    [settingsDraft, toast],
  )

  const roundStatusBadge = useMemo(() => {
    const round = activeRound
    if (!round) return null
    const statusMap: Record<string, string> = {
      open: "bg-emerald-100 text-emerald-700",
      closed: "bg-amber-100 text-amber-700",
      completed: "bg-slate-200 text-slate-800",
    }
    return <Badge className={cn("capitalize", statusMap[round.status] ?? "bg-slate-200 text-slate-800")}>{round.status}</Badge>
  }, [activeRound])

  const participantsEmptyState = !participants.length && !loading

  return (
    <Card className="border-none shadow-xl">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" /> Lucky Draw Control Center
            </CardTitle>
            <CardDescription>Manage the blind box rounds, participants, and automation settings.</CardDescription>
          </div>
          <Button variant="outline" onClick={fetchCurrent} disabled={loading} className="flex items-center gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="current">Current Round</TabsTrigger>
            <TabsTrigger value="history">Rounds History</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="space-y-6">
            <Card className="border border-border/50 shadow-sm">
              <CardHeader className="space-y-1">
                <CardTitle className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-primary" />
                  {currentRound ? "Active Round" : pendingRound ? "Awaiting Draw" : "No Active Round"}
                </CardTitle>
                <CardDescription>
                  {activeRound
                    ? `Entries close on ${formatDateTime(activeRound.endsAt)}.`
                    : "A new round will begin once the previous draw is finalized."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  {roundStatusBadge}
                  {activeRound && (
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(activeRound.entryFee)} entry • {formatCurrency(activeRound.prize)} prize pool • {activeRound.totalEntries} participants
                    </p>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <RoundMeta label="Entry Fee" value={formatCurrency(activeRound?.entryFee ?? settings?.entryFee ?? 10)} />
                  <RoundMeta label="Prize" value={formatCurrency(activeRound?.prize ?? settings?.prize ?? 30)} />
                  <RoundMeta label="Starts" value={activeRound ? formatDateTime(activeRound.startsAt) : "—"} />
                  <RoundMeta label="Ends" value={activeRound ? formatDateTime(activeRound.endsAt) : "—"} />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={handleDrawNow} disabled={!activeRound || loading} className="flex items-center gap-2">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Draw Now
                  </Button>
                  <Button variant="secondary" onClick={handleExport} disabled={!participants.length || loading} className="flex items-center gap-2">
                    <Download className="h-4 w-4" /> Export CSV
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" /> Participants
                </CardTitle>
                <CardDescription>
                  {participantsEmptyState ? "No participants yet." : "Manage the current round entrants."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {participantsEmptyState ? (
                  <p className="text-sm text-muted-foreground">Participants will appear here once users join the draw.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Player</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Referral</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {participants.map((participant) => (
                        <TableRow key={participant._id}>
                          <TableCell>{participant.user?.name ?? "Unknown"}</TableCell>
                          <TableCell>{participant.user?.email ?? "—"}</TableCell>
                          <TableCell>{participant.user?.referralCode ?? "—"}</TableCell>
                          <TableCell>{formatDateTime(participant.joinedAt)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRefund(participant._id)}
                              disabled={loading || !activeRound}
                            >
                              Refund
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Completed Rounds</h3>
              <Button variant="outline" onClick={fetchHistory} disabled={historyLoading} className="flex items-center gap-2">
                {historyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
              </Button>
            </div>
            <Card className="border border-border/50 shadow-sm">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Round</TableHead>
                      <TableHead>Prize</TableHead>
                      <TableHead>Entries</TableHead>
                      <TableHead>Winner</TableHead>
                      <TableHead>Payout</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                          No completed rounds yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      history.map((round) => (
                        <TableRow key={round.id}>
                          <TableCell>{formatDateRange(round.startsAt, round.endsAt)}</TableCell>
                          <TableCell>{formatCurrency(round.prize)}</TableCell>
                          <TableCell>{round.totalEntries}</TableCell>
                          <TableCell>
                            {round.winnerSnapshot
                              ? `${round.winnerSnapshot.name || "Winner"} (${round.winnerSnapshot.referralCode || "—"})`
                              : "—"}
                          </TableCell>
                          <TableCell>{round.completedAt ? formatDateTime(round.completedAt) : "—"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card className="border border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle>Automation &amp; Rewards</CardTitle>
                <CardDescription>Adjust the draw fee, prize, cadence, and automation controls.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="grid gap-6 sm:grid-cols-2" onSubmit={handleSaveSettings}>
                  <div className="space-y-2">
                    <Label htmlFor="entryFee">Entry Fee (USD)</Label>
                    <Input
                      id="entryFee"
                      name="entryFee"
                      type="number"
                      step="0.01"
                      value={settingsDraft.entryFee}
                      onChange={(event) =>
                        setSettingsDraft((prev) => ({ ...prev, entryFee: Number.parseFloat(event.target.value) || 0 }))
                      }
                      min={0}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prize">Prize (USD)</Label>
                    <Input
                      id="prize"
                      name="prize"
                      type="number"
                      step="0.01"
                      value={settingsDraft.prize}
                      onChange={(event) =>
                        setSettingsDraft((prev) => ({ ...prev, prize: Number.parseFloat(event.target.value) || 0 }))
                      }
                      min={0}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cycleHours">Cycle Length (hours)</Label>
                    <Input
                      id="cycleHours"
                      name="cycleHours"
                      type="number"
                      step="1"
                      value={settingsDraft.cycleHours}
                      onChange={(event) =>
                        setSettingsDraft((prev) => ({ ...prev, cycleHours: Number.parseFloat(event.target.value) || 0 }))
                      }
                      min={1}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="autoDrawEnabled">Auto Draw</Label>
                    <div className="flex h-12 items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-3">
                      <Switch
                        id="autoDrawEnabled"
                        name="autoDrawEnabled"
                        checked={settingsDraft.autoDrawEnabled}
                        onCheckedChange={(value) =>
                          setSettingsDraft((prev) => ({ ...prev, autoDrawEnabled: value }))
                        }
                      />
                      <span className="text-sm text-muted-foreground">Automatically finalize rounds when they end.</span>
                    </div>
                  </div>
                  <div className="sm:col-span-2 flex items-center justify-end gap-3">
                    <Button type="submit" disabled={settingsSaving}>
                      {settingsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Settings"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function formatDateTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).format(date)
}

function formatDateRange(startIso: string, endIso: string) {
  const start = new Date(startIso)
  const end = new Date(endIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "—"
  }
  const formatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" })
  return `${formatter.format(start)} → ${formatter.format(end)}`
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

function RoundMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="text-base font-semibold text-foreground">{value}</p>
    </div>
  )
}
