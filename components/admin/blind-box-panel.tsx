"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, RefreshCcw, ShieldCheck, Sparkles, Users, Zap } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

interface AdminBlindBoxConfig {
  depositAmount: number
  rewardAmount: number
  cycleHours: number
  autoDrawEnabled: boolean
}

interface AdminBlindBoxParticipant {
  id: string
  user: {
    id: string
    name: string
    email: string
    referralCode: string
  } | null
  joinedAt: string
  status: "active" | "eliminated"
  hashedUserId: string
}

interface AdminBlindBoxRoundSummary {
  id: string
  startTime: string
  endTime: string
  status: "open" | "completed"
  totalParticipants: number
  rewardAmount: number
  depositAmount: number
  winnerSnapshot?: {
    name: string
    referralCode?: string | null
    email?: string | null
    creditedAt?: string | null
  } | null
}

interface AdminBlindBoxOverview {
  round: AdminBlindBoxRoundSummary | null
  previousRound: AdminBlindBoxRoundSummary | null
  participants: AdminBlindBoxParticipant[]
  config: AdminBlindBoxConfig
}

export function BlindBoxAdminPanel() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [overview, setOverview] = useState<AdminBlindBoxOverview | null>(null)
  const [history, setHistory] = useState<AdminBlindBoxRoundSummary[]>([])
  const [settingsDraft, setSettingsDraft] = useState<AdminBlindBoxConfig>({
    depositAmount: 10,
    rewardAmount: 30,
    cycleHours: 72,
    autoDrawEnabled: true,
  })
  const [manualWinnerId, setManualWinnerId] = useState<string>("")
  const [activeTab, setActiveTab] = useState("overview")

  const activeRound = overview?.round
  const participants = overview?.participants ?? []
  const config = overview?.config ?? settingsDraft
  const nextDrawAt = activeRound ? new Date(activeRound.endTime).toLocaleString() : "To be scheduled"
  const roundStatusLabel = activeRound ? (activeRound.status === "open" ? "Open" : "Completed") : "Not started"

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
        fetch("/api/admin/blindbox/overview"),
        fetch("/api/admin/blindbox/rounds?limit=25"),
      ])
      if (!overviewRes.ok) {
        const data = await overviewRes.json().catch(() => ({}))
        throw new Error(data.error || "Unable to load blind box overview")
      }
      if (!historyRes.ok) {
        const data = await historyRes.json().catch(() => ({}))
        throw new Error(data.error || "Unable to load round history")
      }
      const overviewData = await overviewRes.json()
      const historyData = await historyRes.json()
      setOverview(overviewData)
      setHistory(historyData.rounds ?? [])
    } catch (error: any) {
      console.error("Blind box admin overview error", error)
      toast({
        title: "Unable to load blind box data",
        description: error?.message ?? "Please try again later.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const handleDraw = useCallback(async () => {
    if (!activeRound) {
      toast({ title: "No active round", variant: "destructive" })
      return
    }
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/blindbox/round/${activeRound.id}/draw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winnerId: manualWinnerId || undefined }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Unable to finalize round")
      }
      toast({ title: "Round finalized", description: "A new round has been started." })
      setManualWinnerId("")
      await refreshAll()
    } catch (error: any) {
      console.error("Finalize blind box round error", error)
      toast({
        title: "Unable to finalize",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [activeRound, manualWinnerId, refreshAll, toast])

  const handleSaveSettings = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/blindbox/settings", {
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
      console.error("Blind box settings update error", error)
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
      participants.map((participant) => ({
        id: participant.user?.id ?? participant.id,
        label: `${participant.user?.name ?? "Unnamed"} (${participant.hashedUserId.slice(0, 10)}...)`,
      })),
    [participants],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Blind Box Management</h2>
          <p className="text-sm text-muted-foreground">
            Track live rounds, review participants, and finalize payouts with a single click.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void refreshAll()} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />} Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="participants">Participants</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="participants" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-sky-500" /> Active participants
              </CardTitle>
              <CardDescription>
                {participants.length} participant{participants.length === 1 ? "" : "s"} registered for the current round.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[440px] rounded-lg border border-muted-foreground/20">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Hash</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {participants.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">
                          No participants yet. Encourage members to join from their dashboard.
                        </TableCell>
                      </TableRow>
                    ) : (
                      participants.map((participant) => (
                        <TableRow key={participant.id}>
                          <TableCell>
                            <div className="font-medium">{participant.user?.name ?? "Unknown"}</div>
                            <div className="text-xs text-muted-foreground">{participant.user?.email ?? "-"}</div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{participant.hashedUserId.slice(0, 24)}...</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
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

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-500" /> Draw control panel
                </CardTitle>
                <CardDescription>
                  Trigger the draw manually, or select a winner if an override is required.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3">
                  <Label htmlFor="manual-winner">Select winner (optional)</Label>
                  <Select value={manualWinnerId} onValueChange={setManualWinnerId}>
                    <SelectTrigger id="manual-winner" className="w-full md:w-72">
                      <SelectValue placeholder="Let system pick randomly" />
                    </SelectTrigger>
                    <SelectContent>
                      {winnerOptions.length === 0 ? (
                        <SelectItem value="" disabled>
                          No participants
                        </SelectItem>
                      ) : (
                        winnerOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => void handleDraw()}
                  disabled={loading || !activeRound}
                  className="gap-2 bg-purple-600 text-white hover:bg-purple-700"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Draw winner now
                </Button>
                <p className="text-xs text-muted-foreground">
                  The draw automatically runs every {config.cycleHours} hours when auto-draw is enabled. Manual draws override
                  the countdown and immediately start a new round.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Round snapshot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Participants</span>
                  <span className="font-medium text-foreground">{activeRound?.totalParticipants ?? participants.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Prize</span>
                  <span className="font-medium text-foreground">${config.rewardAmount.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Entry fee</span>
                  <span className="font-medium text-foreground">${config.depositAmount.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Next draw</span>
                  <span className="font-medium text-foreground">{nextDrawAt}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Auto draw</span>
                  <Badge variant={config.autoDrawEnabled ? "default" : "secondary"}>
                    {config.autoDrawEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Status</span>
                  <span className="font-medium text-foreground">{roundStatusLabel}</span>
                </div>
              </CardContent>
            </Card>
          </div>

        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Recent rounds</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-72 rounded-lg border border-muted-foreground/20">
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
                          No round history yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      history.map((round) => (
                        <TableRow key={round.id}>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(round.endTime).toLocaleString()}
                          </TableCell>
                          <TableCell>{round.totalParticipants}</TableCell>
                          <TableCell>${round.rewardAmount.toFixed(2)}</TableCell>
                          <TableCell className="text-xs">
                            {round.winnerSnapshot?.name ?? "TBD"}
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

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-semibold">Draw settings</CardTitle>
              <CardDescription>Update deposit amount, reward value, and automation preferences.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="depositAmount">Deposit amount (USD)</Label>
                  <Input
                    id="depositAmount"
                    type="number"
                    min={1}
                    value={settingsDraft.depositAmount}
                    onChange={(event) =>
                      setSettingsDraft((prev) => ({ ...prev, depositAmount: Number(event.target.value) || prev.depositAmount }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rewardAmount">Reward amount (USD)</Label>
                  <Input
                    id="rewardAmount"
                    type="number"
                    min={1}
                    value={settingsDraft.rewardAmount}
                    onChange={(event) =>
                      setSettingsDraft((prev) => ({ ...prev, rewardAmount: Number(event.target.value) || prev.rewardAmount }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cycleHours">Draw interval (hours)</Label>
                  <Input
                    id="cycleHours"
                    type="number"
                    min={1}
                    value={settingsDraft.cycleHours}
                    onChange={(event) =>
                      setSettingsDraft((prev) => ({ ...prev, cycleHours: Number(event.target.value) || prev.cycleHours }))
                    }
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="auto-draw"
                  checked={settingsDraft.autoDrawEnabled}
                  onCheckedChange={(checked) =>
                    setSettingsDraft((prev) => ({ ...prev, autoDrawEnabled: checked }))
                  }
                />
                <Label htmlFor="auto-draw" className="text-sm">
                  Enable automatic draw every {settingsDraft.cycleHours} hours
                </Label>
              </div>
              <Button onClick={() => void handleSaveSettings()} disabled={loading} className="gap-2 self-start">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Save settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
