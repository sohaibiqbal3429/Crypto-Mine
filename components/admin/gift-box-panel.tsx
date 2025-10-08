"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Percent, RefreshCcw, ShieldCheck, Sparkles, Users } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"

const DEFAULT_GIFT_BOX_CONFIG: AdminGiftBoxConfig = {
  ticketPrice: 10,
  payoutPercentage: 90,
  cycleHours: 72,
  winnersCount: 1,
  autoDrawEnabled: true,
  refundPercentage: 0,
  depositAddress: "",
}

function createDefaultGiftBoxConfig(): AdminGiftBoxConfig {
  return { ...DEFAULT_GIFT_BOX_CONFIG }
}

function sanitizeConfig(raw: any): AdminGiftBoxConfig {
  const safeNumber = (value: unknown, fallback: number, options: { min?: number; max?: number } = {}) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return fallback
    }
    if (typeof options.min === "number" && value < options.min) {
      return options.min
    }
    if (typeof options.max === "number" && value > options.max) {
      return options.max
    }
    return value
  }

  return {
    ticketPrice: safeNumber(raw?.ticketPrice, DEFAULT_GIFT_BOX_CONFIG.ticketPrice, { min: 0 }),
    payoutPercentage: safeNumber(raw?.payoutPercentage, DEFAULT_GIFT_BOX_CONFIG.payoutPercentage, {
      min: 0,
      max: 100,
    }),
    cycleHours: safeNumber(raw?.cycleHours, DEFAULT_GIFT_BOX_CONFIG.cycleHours, { min: 1 }),
    winnersCount: Math.max(1, Math.floor(safeNumber(raw?.winnersCount, DEFAULT_GIFT_BOX_CONFIG.winnersCount, { min: 1 }))),
    autoDrawEnabled:
      typeof raw?.autoDrawEnabled === "boolean" ? raw.autoDrawEnabled : DEFAULT_GIFT_BOX_CONFIG.autoDrawEnabled,
    refundPercentage: safeNumber(raw?.refundPercentage, DEFAULT_GIFT_BOX_CONFIG.refundPercentage, {
      min: 0,
      max: 100,
    }),
    depositAddress: typeof raw?.depositAddress === "string" ? raw.depositAddress : DEFAULT_GIFT_BOX_CONFIG.depositAddress,
  }
}

function sanitizeParticipant(raw: any): AdminGiftBoxParticipant | null {
  if (!raw || typeof raw !== "object") return null

  const id = typeof raw.id === "string" ? raw.id : typeof raw._id === "string" ? raw._id : null
  const joinedAt = typeof raw.joinedAt === "string" ? raw.joinedAt : null
  if (!id || !joinedAt) {
    return null
  }

  const status = raw.status === "eliminated" ? "eliminated" : "active"

  let user: AdminGiftBoxParticipant["user"] = null
  if (raw.user && typeof raw.user === "object") {
    const rawUser = raw.user as Record<string, unknown>
    const userId =
      typeof rawUser.id === "string"
        ? rawUser.id
        : typeof rawUser._id === "string"
          ? (rawUser._id as string)
          : id
    user = {
      id: userId,
      name: typeof rawUser.name === "string" ? rawUser.name : "",
      email: typeof rawUser.email === "string" ? rawUser.email : "",
      referralCode: typeof rawUser.referralCode === "string" ? rawUser.referralCode : "",
    }
  }

  return {
    id,
    user,
    joinedAt,
    status,
    hashedUserId: typeof raw.hashedUserId === "string" ? raw.hashedUserId : null,
  }
}

function sanitizeFairness(raw: any): AdminGiftBoxCycleSummary["fairnessProof"] {
  if (!raw || typeof raw !== "object") return null
  if (typeof raw.serverSeed !== "string" || typeof raw.hash !== "string") {
    return null
  }

  const nonce = typeof raw.nonce === "number" && Number.isFinite(raw.nonce) ? raw.nonce : 0
  const winnerIndex = typeof raw.winnerIndex === "number" && Number.isFinite(raw.winnerIndex) ? raw.winnerIndex : 0

  return {
    serverSeed: raw.serverSeed,
    clientSeed: typeof raw.clientSeed === "string" ? raw.clientSeed : "",
    nonce,
    hash: raw.hash,
    winnerIndex,
  }
}

function sanitizeWinnerSnapshot(raw: any): AdminGiftBoxCycleSummary["winnerSnapshot"] {
  if (!raw || typeof raw !== "object") return null
  if (typeof raw.name !== "string") return null

  return {
    name: raw.name,
    referralCode: typeof raw.referralCode === "string" ? raw.referralCode : null,
    email: typeof raw.email === "string" ? raw.email : null,
    creditedAt: typeof raw.creditedAt === "string" ? raw.creditedAt : null,
  }
}

function sanitizeCycle(raw: any): AdminGiftBoxCycleSummary | null {
  if (!raw || typeof raw !== "object") return null
  if (typeof raw.id !== "string" || typeof raw.startTime !== "string" || typeof raw.endTime !== "string") {
    return null
  }

  return {
    id: raw.id,
    startTime: raw.startTime,
    endTime: raw.endTime,
    status: raw.status === "completed" ? "completed" : "open",
    totalParticipants: typeof raw.totalParticipants === "number" && Number.isFinite(raw.totalParticipants)
      ? raw.totalParticipants
      : 0,
    ticketPrice: typeof raw.ticketPrice === "number" && Number.isFinite(raw.ticketPrice) ? raw.ticketPrice : 0,
    payoutPercentage:
      typeof raw.payoutPercentage === "number" && Number.isFinite(raw.payoutPercentage) ? raw.payoutPercentage : 0,
    winnerSnapshot: sanitizeWinnerSnapshot(raw.winnerSnapshot),
    fairnessProof: sanitizeFairness(raw.fairnessProof),
  }
}

function sanitizeOverview(raw: any): AdminGiftBoxOverview | null {
  if (!raw || typeof raw !== "object") return null

  const participants = Array.isArray(raw.participants)
    ? (raw.participants.map(sanitizeParticipant).filter(Boolean) as AdminGiftBoxParticipant[])
    : []

  return {
    cycle: sanitizeCycle(raw.cycle),
    previousCycle: sanitizeCycle(raw.previousCycle),
    participants,
    config: sanitizeConfig(raw.config ?? {}),
  }
}

function sanitizeHistory(raw: any): AdminGiftBoxCycleSummary[] {
  if (Array.isArray(raw)) {
    return raw.map(sanitizeCycle).filter(Boolean) as AdminGiftBoxCycleSummary[]
  }

  if (raw && typeof raw === "object" && Array.isArray(raw.cycles)) {
    return raw.cycles.map(sanitizeCycle).filter(Boolean) as AdminGiftBoxCycleSummary[]
  }

  return []
}

async function safeParseJson<T>(response: Response): Promise<T | null> {
  try {
    return await response.json()
  } catch (error) {
    console.error("Failed to parse JSON response", error)
    return null
  }
}

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
  const [settingsDraft, setSettingsDraft] = useState<AdminGiftBoxConfig>(createDefaultGiftBoxConfig)
  const [manualWinnerId, setManualWinnerId] = useState<string>("")
  const [serverSeedOverride, setServerSeedOverride] = useState("")
  const [clientSeedOverride, setClientSeedOverride] = useState("")
  const [nonceOverride, setNonceOverride] = useState("")
  const [activeTab, setActiveTab] = useState("overview")
  const [dataError, setDataError] = useState<string | null>(null)

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
      setSettingsDraft({ ...overview.config })
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
      const overviewData = await safeParseJson<unknown>(overviewRes)
      const historyData = await safeParseJson<unknown>(historyRes)

      const sanitizedOverview = sanitizeOverview(overviewData)
      if (!sanitizedOverview) {
        throw new Error("Received malformed data for the Gift Box overview")
      }

      const sanitizedHistory = sanitizeHistory(historyData)

      setOverview(sanitizedOverview)
      setHistory(sanitizedHistory)
      setDataError(null)
    } catch (error: any) {
      console.error("Gift box admin overview error", error)
      setOverview(null)
      setHistory([])
      setDataError(error?.message ?? "Please try again later.")
      setSettingsDraft(createDefaultGiftBoxConfig())
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
      const parsedNonce = Number.parseInt(nonceOverride, 10)
      const response = await fetch(`/api/admin/giftbox/cycle/${activeCycle.id}/draw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          winnerId: manualWinnerId || undefined,
          startNextCycle: true,
          serverSeed: serverSeedOverride || undefined,
          clientSeed: clientSeedOverride || undefined,
          nonce: Number.isFinite(parsedNonce) ? parsedNonce : undefined,
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
          label: `${participant.user?.name?.trim() ? participant.user?.name : "Unnamed"} (${hashed}…)`,
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

      {dataError && (
        <Alert variant="destructive">
          <AlertDescription>{dataError}</AlertDescription>
        </Alert>
      )}

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
