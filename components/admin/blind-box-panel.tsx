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
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

interface AdminBlindBoxConfig {
  depositAmount: number
  rewardAmount: number
  cycleHours: number
  autoDrawEnabled: boolean
}

interface AdminBlindBoxDeposit {
  id: string
  txId: string
  amount: number
  network: string
  address: string
  createdAt: string
  status: "pending" | "approved" | "rejected"
  user: {
    id: string
    name: string
    email: string
    referralCode: string
  } | null
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
  pendingDeposits: AdminBlindBoxDeposit[]
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
  const [selectedDepositId, setSelectedDepositId] = useState<string | null>(null)
  const [manualWinnerId, setManualWinnerId] = useState<string>("")
  const [rejectionReason, setRejectionReason] = useState("")
  const [activeTab, setActiveTab] = useState("deposits")

  const activeRound = overview?.round
  const participants = overview?.participants ?? []
  const pendingDeposits = overview?.pendingDeposits ?? []
  const config = overview?.config ?? settingsDraft

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

  const handleApproveDeposit = useCallback(
    async (depositId: string) => {
      setSelectedDepositId(depositId)
      try {
        const response = await fetch(`/api/admin/blindbox/deposits/${depositId}/approve`, { method: "POST" })
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || "Unable to approve deposit")
        }
        toast({ title: "Deposit approved" })
        await refreshAll()
      } catch (error: any) {
        console.error("Approve blind box deposit error", error)
        toast({
          title: "Unable to approve",
          description: error?.message ?? "Please try again later.",
          variant: "destructive",
        })
      } finally {
        setSelectedDepositId(null)
      }
    },
    [refreshAll, toast],
  )

  const handleRejectDeposit = useCallback(
    async (depositId: string) => {
      setSelectedDepositId(depositId)
      try {
        const response = await fetch(`/api/admin/blindbox/deposits/${depositId}/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: rejectionReason }),
        })
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || "Unable to reject deposit")
        }
        toast({ title: "Deposit rejected" })
        setRejectionReason("")
        await refreshAll()
      } catch (error: any) {
        console.error("Reject blind box deposit error", error)
        toast({
          title: "Unable to reject",
          description: error?.message ?? "Please try again later.",
          variant: "destructive",
        })
      } finally {
        setSelectedDepositId(null)
      }
    },
    [refreshAll, rejectionReason, toast],
  )

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
            Review deposits, manage participants, and control automated lucky draw rounds.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void refreshAll()} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />} Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="deposits">Deposits</TabsTrigger>
          <TabsTrigger value="participants">Participants</TabsTrigger>
          <TabsTrigger value="control">Draw Control</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="deposits" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-500" /> Pending deposits
              </CardTitle>
              <CardDescription>Manually verify each deposit before participants enter the draw.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pendingDeposits.length === 0 ? (
                <div className="rounded-lg border border-dashed border-muted-foreground/30 p-6 text-center text-sm text-muted-foreground">
                  No pending deposits. Great job staying on top of reviews!
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>TxID</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingDeposits.map((deposit) => (
                      <TableRow key={deposit.id}>
                        <TableCell className="space-y-1">
                          <div className="font-medium">{deposit.user?.name ?? "Unknown"}</div>
                          <div className="text-xs text-muted-foreground">{deposit.user?.email ?? "-"}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-xs">{deposit.txId}</div>
                        </TableCell>
                        <TableCell>${deposit.amount.toFixed(2)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(deposit.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-destructive/40 text-destructive"
                            onClick={() => void handleRejectDeposit(deposit.id)}
                            disabled={selectedDepositId === deposit.id}
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            className="bg-emerald-500 text-white hover:bg-emerald-600"
                            onClick={() => void handleApproveDeposit(deposit.id)}
                            disabled={selectedDepositId === deposit.id}
                          >
                            {selectedDepositId === deposit.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Approve"
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="rounded-lg border border-muted-foreground/20 bg-muted/10 p-4">
            <Label htmlFor="rejection-reason" className="text-sm font-medium">
              Optional rejection reason
            </Label>
            <Textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder="Add a short explanation that will be sent with the rejection notification"
              className="mt-2"
              rows={3}
            />
          </div>
        </TabsContent>

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
                          No participants yet. Approve deposits to populate this list.
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

        <TabsContent value="control" className="space-y-6">
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
                  <span className="font-medium text-foreground">{participants.length}</span>
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
                  <span>Auto draw</span>
                  <Badge variant={config.autoDrawEnabled ? "default" : "secondary"}>
                    {config.autoDrawEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

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
