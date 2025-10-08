"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Percent, RefreshCcw, ShieldCheck, Sparkles, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/components/ui/use-toast"

interface AdminGiftBoxConfig {
  ticketPrice: number
  payoutPercentage: number
  cycleHours: number
  winnersCount: number
  autoDrawEnabled: boolean
  refundPercentage: number
  depositAddress: string
}

interface AdminGiftBoxParticipant {
  id: string
  user: {
    id: string
    name: string
    email: string
    referralCode: string
  } | null
  joinedAt: string
  status: "active" | "eliminated"
  hashedUserId: string | null
}

interface AdminGiftBoxCycleSummary {
  id: string
  startTime: string
  endTime: string
  status: "open" | "completed"
  totalParticipants: number
  ticketPrice: number
  payoutPercentage: number
  winnerSnapshot?: {
    name: string
    referralCode?: string | null
    email?: string | null
    creditedAt?: string | null
  } | null
  fairnessProof?: {
    serverSeed: string
    clientSeed: string
    nonce: number
    hash: string
    winnerIndex: number
  } | null
}

interface AdminGiftBoxOverview {
  cycle: AdminGiftBoxCycleSummary | null
  previousCycle: AdminGiftBoxCycleSummary | null
  participants: AdminGiftBoxParticipant[]
  config: AdminGiftBoxConfig
}

export function GiftBoxAdminPanel() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [overview, setOverview] = useState<AdminGiftBoxOverview | null>(null)
  const [history, setHistory] = useState<AdminGiftBoxCycleSummary[]>([])
  const [settingsDraft, setSettingsDraft] = useState<AdminGiftBoxConfig>({
    ticketPrice: 10,
    payoutPercentage: 90,
    cycleHours: 72,
    winnersCount: 1,
    autoDrawEnabled: true,
    refundPercentage: 0,
    depositAddress: "",
  })
  const [manualWinnerId, setManualWinnerId] = useState<string>("")
  const [serverSeedOverride, setServerSeedOverride] = useState("")
  const [clientSeedOverride, setClientSeedOverride] = useState("")
  const [nonceOverride, setNonceOverride] = useState("")
  const [activeTab, setActiveTab] = useState("overview")

  const activeCycle = overview?.cycle
  const participants = overview?.participants ?? []
  const config = overview?.config ?? settingsDraft
  const nextDrawAt = activeCycle ? new Date(activeCycle.endTime).toLocaleString() : "To be scheduled"
  const cycleStatusLabel = activeCycle ? (activeCycle.status === "open" ? "Open" : "Completed") : "Not started"

  useEffect(() => {
    void refreshAll()
  }, [])

  useEffect(() => {
    if (overview?.config) {
      setSettingsDraft(overview.config)
    }
  }, [overview?.config])

  const refreshAll = useCallback(async () => {
    setLoading(true)
    try {
      const [overviewRes, historyRes] = await Promise.all([
        fetch("/api/admin/giftbox/overview"),
        fetch("/api/admin/giftbox/cycles?limit=25"),
      ])
      if (!overviewRes.ok) {
        const data = await overviewRes.json().catch(() => ({}))
        throw new Error(data.error || "Unable to load Gift Box overview")
      }
      if (!historyRes.ok) {
        const data = await historyRes.json().catch(() => ({}))
        throw new Error(data.error || "Unable to load cycle history")
      }
      const overviewData = await overviewRes.json()
      const historyData = await historyRes.json()
      setOverview(overviewData)
      setHistory(historyData.cycles ?? [])
    } catch (error: any) {
      console.error("Gift box admin overview error", error)
      toast({
        title: "Unable to load gift box data",
        description: error?.message ?? "Please try again later.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const handleDraw = useCallback(async () => {
    if (!activeCycle) {
      toast({ title: "No active cycle", variant: "destructive" })
      return
    }
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/giftbox/cycle/${activeCycle.id}/draw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          winnerId: manualWinnerId || undefined,
          startNextCycle: true,
          serverSeed: serverSeedOverride || undefined,
          clientSeed: clientSeedOverride || undefined,
          nonce: nonceOverride ? Number.parseInt(nonceOverride, 10) : undefined,
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Unable to finalize cycle")
      }
      toast({ title: "Cycle finalized", description: "A new giveaway cycle has been started." })
      setManualWinnerId("")
      setServerSeedOverride("")
      setClientSeedOverride("")
      setNonceOverride("")
      await refreshAll()
    } catch (error: any) {
      console.error("Finalize gift box cycle error", error)
      toast({
        title: "Unable to finalize",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [activeCycle, clientSeedOverride, manualWinnerId, nonceOverride, refreshAll, serverSeedOverride, toast])

  const handleSaveSettings = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/giftbox/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsDraft),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Unable to update settings")
      }
      toast({ title: "Settings updated" })
      await refreshAll()
    } catch (error: any) {
      console.error("Gift box settings update error", error)
      toast({
        title: "Unable to save",
        description: error?.message ?? "Please try again later.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [refreshAll, settingsDraft, toast])

  const winnerOptions = useMemo(
    () =>
      participants.map((participant) => {
        const hashed = participant.hashedUserId ? participant.hashedUserId.slice(0, 10) : "unknown"
        return {
          id: participant.user?.id ?? participant.id,
          label: `${participant.user?.name ?? "Unnamed"} (${hashed}…)`,
        }
      }),
    [participants],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Gift Box Giveaway</h2>
          <p className="text-sm text-muted-foreground">
            Monitor live cycles, audit the fairness log, and finalize winners with a provably fair workflow.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void refreshAll()} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />} Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Live cycle</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <div className="text-2xl font-semibold">{cycleStatusLabel}</div>
                <p className="text-xs text-muted-foreground">Next draw at {nextDrawAt}</p>
                <Badge variant="secondary" className="w-fit">
                  <Users className="mr-1 h-4 w-4" /> {participants.length} participants
                </Badge>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Current pot</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <div className="text-2xl font-semibold">
                  ${(participants.length * config.ticketPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground">{config.payoutPercentage}% paid out to the winner.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Fairness hash</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-xs text-muted-foreground">
                  {activeCycle?.fairnessProof?.hash ? activeCycle.fairnessProof.hash.slice(0, 24) + "…" : "Pending draw"}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" /> Manual draw controls
              </CardTitle>
              <CardDescription>
                Force a payout if needed. Provide optional seeds to override the fairness proof for emergency draws.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Winner override</Label>
                  <Select value={manualWinnerId} onValueChange={setManualWinnerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Random winner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Random (fairness proof)</SelectItem>
                      {winnerOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Server seed override</Label>
                  <Input
                    value={serverSeedOverride}
                    onChange={(event) => setServerSeedOverride(event.target.value)}
                    placeholder="Leave blank to auto-generate"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Client seed override</Label>
                  <Input
                    value={clientSeedOverride}
                    onChange={(event) => setClientSeedOverride(event.target.value)}
                    placeholder="Leave blank to aggregate"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Nonce override</Label>
                  <Input
                    value={nonceOverride}
                    onChange={(event) => setNonceOverride(event.target.value)}
                    placeholder="Default uses participant count"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => void handleDraw()} disabled={loading} className="gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Finalize now
                </Button>
                <Button variant="outline" onClick={() => void refreshAll()} disabled={loading}>
                  Refresh state
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> Participants
              </CardTitle>
              <CardDescription>Live list of entrants for the active cycle.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-72">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Referral</TableHead>
                      <TableHead>Hashed ID</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {participants.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                          No entrants yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      participants.map((participant) => (
                        <TableRow key={participant.id}>
                          <TableCell>{participant.user?.name ?? "Unknown"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{participant.user?.email ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{participant.user?.referralCode ?? "—"}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {participant.hashedUserId ? `${participant.hashedUserId.slice(0, 12)}…` : "Unknown"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(participant.joinedAt).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5 text-primary" /> Completed cycles
              </CardTitle>
              <CardDescription>Review prior draws with payout and fairness data.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cycle</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Participants</TableHead>
                    <TableHead>Winner</TableHead>
                    <TableHead>Fairness hash</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                        No previous cycles recorded.
                      </TableCell>
                    </TableRow>
                  ) : (
                    history.map((cycle) => (
                      <TableRow key={cycle.id}>
                        <TableCell className="font-medium">{cycle.id.slice(-6).toUpperCase()}</TableCell>
                        <TableCell>
                          {new Date(cycle.startTime).toLocaleString()}
                          <br />
                          <span className="text-xs text-muted-foreground">
                            → {new Date(cycle.endTime).toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell>{cycle.totalParticipants}</TableCell>
                        <TableCell>{cycle.winnerSnapshot?.name ?? "Pending"}</TableCell>
                        <TableCell>
                          {cycle.fairnessProof?.hash ? cycle.fairnessProof.hash.slice(0, 24) + "…" : "TBA"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>Update default ticket price, payout percentage, and scheduling.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Ticket price (USDT)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={settingsDraft.ticketPrice}
                    onChange={(event) => setSettingsDraft((draft) => ({ ...draft, ticketPrice: Number(event.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payout percentage</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={settingsDraft.payoutPercentage}
                    onChange={(event) =>
                      setSettingsDraft((draft) => ({ ...draft, payoutPercentage: Number(event.target.value) }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cycle duration (hours)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={settingsDraft.cycleHours}
                    onChange={(event) => setSettingsDraft((draft) => ({ ...draft, cycleHours: Number(event.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Winners per cycle</Label>
                  <Input
                    type="number"
                    min={1}
                    value={settingsDraft.winnersCount}
                    onChange={(event) => setSettingsDraft((draft) => ({ ...draft, winnersCount: Number(event.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Refund percentage</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={settingsDraft.refundPercentage}
                    onChange={(event) =>
                      setSettingsDraft((draft) => ({ ...draft, refundPercentage: Number(event.target.value) }))
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Deposit address</Label>
                  <Input
                    value={settingsDraft.depositAddress}
                    onChange={(event) =>
                      setSettingsDraft((draft) => ({ ...draft, depositAddress: event.target.value }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-4 md:col-span-2">
                  <div className="space-y-1">
                    <Label className="text-sm">Automatic draw</Label>
                    <p className="text-xs text-muted-foreground">
                      When enabled the platform automatically closes the cycle at the scheduled end time.
                    </p>
                  </div>
                  <Switch
                    checked={settingsDraft.autoDrawEnabled}
                    onCheckedChange={(checked) =>
                      setSettingsDraft((draft) => ({ ...draft, autoDrawEnabled: checked }))
                    }
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => void handleSaveSettings()} disabled={loading}>
                  Save changes
                </Button>
                <Button variant="outline" onClick={() => void refreshAll()} disabled={loading}>
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
