"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import useSWR from "swr"

import { Sidebar } from "@/components/layout/sidebar"
import { TeamRewardsCard } from "@/components/team/team-rewards-card"
import { TeamRewardsHistory, type TeamRewardHistoryEntry } from "@/components/team/team-rewards-history"
import { LevelProgress } from "@/components/team/level-progress"
import {
  TeamHierarchyChart,
  TeamHierarchySkeleton,
} from "@/components/team/team-hierarchy-chart"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { TEAM_REWARD_UNLOCK_LEVEL } from "@/lib/constants/bonuses"
import { formatCurrency, formatDate, formatTime } from "@/lib/utils/formatting"
import { ensureDate, ensureNumber } from "@/lib/utils/safe-parsing"

import { TeamList } from "./TeamList"

const LEVEL_CACHE_KEY = "team-level-progress-cache-v1"

function readCachedLevelData(): LevelResponse | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const raw = window.sessionStorage.getItem(LEVEL_CACHE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === "object") {
      return parsed as LevelResponse
    }
  } catch (error) {
    console.error("Failed to read cached level progress", error)
  }

  return null
}

async function fetcher<T>(url: string): Promise<T> {
  try {
    const response = await fetch(url, { credentials: "include" })
    const contentType = response.headers.get("content-type") ?? ""
    let payload: unknown = null

    if (contentType.includes("application/json")) {
      try {
        payload = await response.json()
      } catch (parseError) {
        console.error(`Failed to parse JSON response from ${url}`, parseError)
      }
    }

    if (!response.ok) {
      const message =
        payload && typeof payload === "object" && payload !== null && "error" in payload &&
        typeof (payload as { error?: unknown }).error === "string"
          ? ((payload as { error: string }).error || "Request failed")
          : response.statusText || "Request failed"

      throw new Error(message || "Request failed")
    }

    if (payload && typeof payload === "object") {
      return payload as T
    }

    return {} as T
  } catch (error) {
    console.error(`Network error while fetching ${url}`, error)
    throw error instanceof Error ? error : new Error("Network request failed")
  }
}

interface PendingRewardItem {
  id?: string
  type?: "TEAM_EARN_L1" | "TEAM_EARN_L2"
  amount?: number
  percent?: number // NOTE: fractional (e.g., 0.02 for 2%)
  baseAmount?: number
  createdAt?: string
  sourceTxId?: string
  payer?: { id?: string | null; name?: string | null; email?: string | null } | null
}

interface RewardsResponse {
  available?: number
  claimedTotal?: number
  lastClaimedAt?: string | null
  creditedAmount?: number
  pending?: PendingRewardItem[] | null
}

interface HistoryResponse {
  entries?: TeamRewardHistoryEntry[] | null
}

interface LevelResponse {
  currentLevel?: number
  currentRule?: any
  nextRule?: any
  levelProgress?: {
    currentActive?: number
    requiredActive?: number
    progress?: number
    nextLevel?: number
  } | null
  teamStats?: {
    totalMembers?: number
    activeMembers?: number
    directReferrals?: number
    directActive?: number
    totalTeamDeposits?: number
    totalTeamEarnings?: number
  } | null
  allRules?: any[]
  directActiveCount?: number
  totalActiveDirects?: number
  lastLevelUpAt?: string | null
  message?: string
}

interface MeResponse {
  user?: {
    id?: string
    name?: string
    email?: string
    referralCode?: string
    role?: string
    profileAvatar?: string
  } | null
}

interface TeamStructureMember {
  _id?: string
  name?: string | null
  email?: string | null
  referralCode?: string | null
  level?: number | null
  depositTotal?: number | null
  isActive?: boolean | null
  qualified?: boolean | null
  createdAt?: string | null
  profileAvatar?: string | null
  children?: TeamStructureMember[] | null
  directCount?: number | null
  activeCount?: number | null
}

interface TeamStructureResponse {
  teamTree?: TeamStructureMember | null
  teamStats?: {
    totalMembers?: number | null
    activeMembers?: number | null
    directReferrals?: number | null
    directActive?: number | null
    totalTeamDeposits?: number | null
    totalTeamEarnings?: number | null
    levels?: { level1?: number | null; level2?: number | null } | null
  } | null
}

interface AvailableToClaimCardProps {
  items: PendingRewardItem[]
  isLoading: boolean
  onClaim: () => void
  isClaiming: boolean
  isLocked?: boolean
  unlockLevel?: number
}

function buildSourceLabel(payer: PendingRewardItem["payer"]): string {
  if (!payer) return "Unknown"
  if (typeof payer.name === "string" && payer.name.trim().length > 0) return payer.name
  if (typeof payer.email === "string" && payer.email.trim().length > 0) return payer.email
  const payerId = typeof payer.id === "string" ? payer.id : null
  return payerId ? `User ${payerId.slice(-6)}` : "Unknown"
}

const toPercentDisplay = (fractional: unknown): string => {
  const value = ensureNumber(fractional, Number.NaN)
  if (!Number.isFinite(value)) return "N/A"
  return `${(value * 100).toFixed(2)}%`
}

function AvailableToClaimCard({
  items,
  isLoading,
  onClaim,
  isClaiming,
  isLocked = false,
  unlockLevel = 1,
}: AvailableToClaimCardProps) {
  const hasItems = items.length > 0
  const sorted = [...items].sort((a, b) => {
    const da = ensureDate(a.createdAt)?.getTime() ?? 0
    const db = ensureDate(b.createdAt)?.getTime() ?? 0
    return db - da // newest first
  })
  const claimDisabled = isClaiming || !hasItems || isLocked
  const unlockLabel = `Level ${unlockLevel}`

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg">Available to Claim</CardTitle>
          <p className="text-sm text-muted-foreground">
            {isLocked
              ? `Team rewards unlock at ${unlockLabel}. Reach ${unlockLabel} to start accumulating claimable earnings.`
              : "Review unclaimed team earnings. Claiming will credit the payout amount to your wallet balance."}
          </p>
        </div>
        <Button onClick={onClaim} disabled={claimDisabled}>
          {isLocked ? `Locked until ${unlockLabel}` : isClaiming ? "Claiming..." : "Claim all"}
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Earned</TableHead>
              <TableHead className="whitespace-nowrap">Source User</TableHead>
              <TableHead className="whitespace-nowrap">Type</TableHead>
              <TableHead className="whitespace-nowrap text-right">Base Amount</TableHead>
              <TableHead className="whitespace-nowrap text-right">Percent</TableHead>
              <TableHead className="whitespace-nowrap text-right">Payout</TableHead>
              <TableHead className="whitespace-nowrap text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <TableRow key={`pending-skeleton-${index}`}>
                  <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-20" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-16" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-24" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="ml-auto h-8 w-20" /></TableCell>
                </TableRow>
              ))
            ) : !hasItems ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  {isLocked
                    ? `Reach ${unlockLabel} to start accumulating claimable team rewards.`
                    : "No team earnings are waiting to be claimed right now. New rewards will appear here when your team earns."}
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((item, index) => {
                const createdAt = ensureDate(item.createdAt)
                const createdDisplay = createdAt
                  ? `${formatDate(createdAt, "long")} ${formatTime(createdAt)}`
                  : "Date unavailable"
                const baseAmount = ensureNumber(item.baseAmount, 0)
                const amount = ensureNumber(item.amount, 0)
                const sourceDisplay = buildSourceLabel(item.payer ?? null)
                const typeLabel =
                  item.type === "TEAM_EARN_L1"
                    ? "Team earning (L1)"
                    : item.type === "TEAM_EARN_L2"
                      ? "Team earning (L2)"
                      : "Team earning"
                const rowKey = typeof item.id === "string" && item.id.length > 0 ? item.id : `pending-${index}`

                return (
                  <TableRow key={rowKey}>
                    <TableCell className="whitespace-nowrap">{createdDisplay}</TableCell>
                    <TableCell className="whitespace-nowrap">{sourceDisplay}</TableCell>
                    <TableCell className="whitespace-nowrap">{typeLabel}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">{formatCurrency(baseAmount)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">{toPercentDisplay(item.percent)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">{formatCurrency(amount)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <Button variant="outline" size="sm" onClick={onClaim} disabled={isClaiming || isLocked}>
                        {isLocked ? "Locked" : "Claim"}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export default function TeamPageShell() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("structure")

  const [cachedLevelData, setCachedLevelData] = useState<LevelResponse | null>(() => readCachedLevelData())

  const { data: meData, isLoading: meLoading } = useSWR<MeResponse>("/api/auth/me", fetcher, {
    revalidateOnFocus: false,
  })

  const user = meData?.user ?? null
  const userId = typeof user?.id === "string" && user.id.length > 0 ? user.id : undefined
  const sidebarUser =
    user &&
    typeof user.name === "string" &&
    typeof user.email === "string" &&
    typeof user.referralCode === "string"
      ? {
          name: user.name,
          email: user.email,
          referralCode: user.referralCode,
          role: typeof user.role === "string" ? user.role : undefined,
          profileAvatar: typeof user.profileAvatar === "string" ? user.profileAvatar : undefined,
        }
      : undefined

  const {
    data: rewardsData,
    isLoading: rewardsLoading,
    error: rewardsError,
    mutate: mutateRewards,
  } = useSWR<RewardsResponse>("/api/team/rewards", fetcher, {
    revalidateOnFocus: false,
  })

  const {
    data: historyData,
    isLoading: historyLoading,
    error: historyError,
    mutate: mutateHistory,
  } = useSWR<HistoryResponse>("/api/team/rewards/history", fetcher, {
    revalidateOnFocus: false,
  })

  const {
    data: levelData,
    isLoading: levelLoading,
    error: levelError,
    mutate: mutateLevels,
    isValidating: levelValidating,
  } = useSWR<LevelResponse>("/api/levels/eligibility", fetcher, {
    revalidateOnFocus: false,
    fallbackData: cachedLevelData ?? undefined,
  })

  const teamStructureKey = userId ? "/api/team/structure" : null
  const {
    data: teamStructureData,
    isLoading: teamStructureLoading,
    error: teamStructureError,
  } = useSWR<TeamStructureResponse>(teamStructureKey, fetcher, {
    revalidateOnFocus: false,
  })

  const previousTabRef = useRef(activeTab)

  useEffect(() => {
    if (!levelData) {
      return
    }

    setCachedLevelData(levelData)

    if (typeof window === "undefined") {
      return
    }

    try {
      window.sessionStorage.setItem(LEVEL_CACHE_KEY, JSON.stringify(levelData))
    } catch (error) {
      console.error("Failed to cache level progress", error)
    }
  }, [levelData])

  useEffect(() => {
    const previousTab = previousTabRef.current
    previousTabRef.current = activeTab

    if (meLoading) {
      return
    }

    if (activeTab === "levels" && previousTab !== "levels") {
      void mutateLevels()
    }
  }, [activeTab, meLoading, mutateLevels])

  const [isClaiming, setIsClaiming] = useState(false)
  const resolvedLevelRaw = levelData?.currentLevel ?? cachedLevelData?.currentLevel ?? null
  const resolvedLevel = resolvedLevelRaw === null ? null : ensureNumber(resolvedLevelRaw, 0)
  const teamRewardsLocked = resolvedLevel !== null ? resolvedLevel < TEAM_REWARD_UNLOCK_LEVEL : false

  const handleClaimRewards = async () => {
    if (isClaiming) return
    if (teamRewardsLocked) {
      toast({
        title: "Team rewards locked",
        description: `Reach Level ${TEAM_REWARD_UNLOCK_LEVEL} to claim team rewards.`,
      })
      return
    }

    setIsClaiming(true)
    try {
      const response = await fetch("/api/team/rewards", { method: "POST", credentials: "include" })
      const contentType = response.headers.get("content-type") ?? ""
      let payload: unknown = null

      if (contentType.includes("application/json")) {
        try {
          payload = await response.json()
        } catch (parseError) {
          console.error("Failed to parse claim rewards response", parseError)
        }
      }

      if (!response.ok) {
        const errorMessage =
          payload && typeof payload === "object" && payload !== null && "error" in payload &&
          typeof (payload as { error?: unknown }).error === "string"
            ? (payload as { error: string }).error
            : "Please try again in a moment."

        toast({
          variant: "destructive",
          title: "Unable to claim rewards",
          description: errorMessage,
        })
        return
      }

      await Promise.all([mutateRewards(), mutateHistory()])

      const credited = ensureNumber((payload as RewardsResponse | null)?.creditedAmount, 0)

      toast({
        title: "Rewards added to balance",
        description: `Successfully claimed ${formatCurrency(credited)}.`,
      })
    } catch (error) {
      console.error("Claim rewards error", error)
      toast({
        variant: "destructive",
        title: "Unexpected error",
        description: "We couldn't process your claim. Please try again.",
      })
    } finally {
      setIsClaiming(false)
    }
  }

  const teamRewards = rewardsData
    ? {
        available: ensureNumber(rewardsData.available, 0),
        claimedTotal: ensureNumber(rewardsData.claimedTotal, 0),
        lastClaimedAt: rewardsData.lastClaimedAt ?? null,
        pending: Array.isArray(rewardsData.pending) ? rewardsData.pending : [],
      }
    : null

  const levelContent = useMemo(() => {
    if (levelLoading && !levelData) {
      return <LevelProgressSkeleton />
    }

    if (levelError && !levelData) {
      return (
        <div className="rounded-xl border border-border/60 bg-card p-6 text-sm text-destructive">
          Unable to load level progress right now. Please try again shortly.
        </div>
      )
    }

    if (levelData) {
      return (
        <LevelProgress
          currentLevel={levelData.currentLevel}
          levelProgress={levelData.levelProgress ?? null}
          teamStats={levelData.teamStats ?? null}
          currentRule={levelData.currentRule}
          nextRule={levelData.nextRule}
          directActiveCount={levelData.directActiveCount}
          totalActiveDirects={levelData.totalActiveDirects}
          lastLevelUpAt={levelData.lastLevelUpAt}
          message={levelData.message}
        />
      )
    }

    return (
      <div className="rounded-xl border border-border/60 bg-card p-6 text-sm text-muted-foreground">
        No level progress data is available yet. Engage your team to start tracking progress.
      </div>
    )
  }, [levelData, levelError, levelLoading])

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <Sidebar user={sidebarUser} />

      <main className="flex-1 overflow-auto md:ml-64">
        <div className="space-y-6 p-5 sm:p-6 lg:p-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-balance">Team Management</h1>
            <p className="text-muted-foreground">Monitor your direct referrals and progression in real time.</p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid h-12 w-full grid-cols-2 rounded-full bg-muted/70 p-1.5">
              <TabsTrigger
                value="structure"
                className="rounded-full px-4 py-2 text-base font-semibold data-[state=active]:shadow-md"
              >
                Team Directory
              </TabsTrigger>
              <TabsTrigger
                value="levels"
                className="rounded-full px-4 py-2 text-base font-semibold data-[state=active]:shadow-md"
              >
                Levels &amp; Progress
              </TabsTrigger>
            </TabsList>

            <TabsContent value="structure" className="space-y-6">
              {rewardsLoading && !teamRewards ? (
                <RewardsCardSkeleton />
              ) : teamRewards ? (
                <TeamRewardsCard
                  available={teamRewards.available}
                  claimedTotal={teamRewards.claimedTotal}
                  lastClaimedAt={teamRewards.lastClaimedAt}
                  isClaiming={isClaiming}
                  onClaim={handleClaimRewards}
                  isLocked={teamRewardsLocked}
                  unlockLevel={TEAM_REWARD_UNLOCK_LEVEL}
                />
              ) : rewardsError ? (
                <div className="rounded-xl border border-border/60 bg-card p-6 text-sm text-destructive">
                  Unable to load rewards summary. Please refresh to try again.
                </div>
              ) : null}

              <AvailableToClaimCard
                items={teamRewards?.pending ?? []}
                isLoading={rewardsLoading}
                onClaim={handleClaimRewards}
                isClaiming={isClaiming}
                isLocked={teamRewardsLocked}
                unlockLevel={TEAM_REWARD_UNLOCK_LEVEL}
              />

              <TeamRewardsHistory
                entries={historyData?.entries ?? []}
                isLoading={historyLoading || (!historyData && !historyError)}
              />

              {historyError ? (
                <div className="rounded-xl border border-border/60 bg-card p-4 text-sm text-destructive">
                  We couldn't load the rewards history. Please refresh the page.
                </div>
              ) : null}

              {teamStructureLoading && !teamStructureData ? (
                <TeamHierarchySkeleton />
              ) : teamStructureData?.teamTree ? (
                <TeamHierarchyChart
                  teamTree={teamStructureData.teamTree}
                  teamStats={teamStructureData.teamStats ?? null}
                />
              ) : teamStructureError ? (
                <div className="rounded-xl border border-border/60 bg-card p-4 text-sm text-destructive">
                  Unable to load the team hierarchy. Please try refreshing the page.
                </div>
              ) : (
                <div className="rounded-xl border border-border/60 bg-card p-6 text-sm text-muted-foreground">
                  Build your network to see a visual hierarchy of how your team is structured.
                </div>
              )}

              <TeamList userId={userId} />
            </TabsContent>

            <TabsContent value="levels" className="space-y-6">
              {levelContent}
              {activeTab === "levels" && levelValidating && levelData ? (
                <div className="text-xs text-muted-foreground">
                  Updating level details...
                </div>
              ) : null}
              {activeTab === "levels" && levelError && levelData ? (
                <div className="text-xs text-destructive">
                  Unable to refresh level progress right now. Showing your last available data.
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}

function RewardsCardSkeleton() {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="space-y-3 rounded-lg border border-dashed border-border/60 p-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    </div>
  )
}

function LevelProgressSkeleton() {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="space-y-2 rounded-lg border border-border/60 p-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}
