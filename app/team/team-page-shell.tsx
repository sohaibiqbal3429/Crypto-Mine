"use client"

import { useState } from "react"
import useSWR from "swr"

import { Sidebar } from "@/components/layout/sidebar"
import { TeamRewardsCard } from "@/components/team/team-rewards-card"
import { TeamRewardsHistory, type TeamRewardHistoryEntry } from "@/components/team/team-rewards-history"
import { LevelProgress } from "@/components/team/level-progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { formatCurrency, formatDate, formatTime } from "@/lib/utils/formatting"

import { TeamList } from "./TeamList"

const fetcher = async (url: string) => {
  const response = await fetch(url, { credentials: "include" })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    const message = typeof error.error === "string" ? error.error : "Request failed"
    throw new Error(message)
  }

  return response.json()
}

interface PendingRewardItem {
  id: string
  type: "TEAM_EARN_L1" | "TEAM_EARN_L2"
  amount: number
  percent: number
  baseAmount: number
  createdAt: string
  sourceTxId: string
  payer: { id: string; name: string | null; email: string | null } | null
}

interface RewardsResponse {
  available?: number
  claimedTotal?: number
  lastClaimedAt?: string | null
  creditedAmount?: number
  pending?: PendingRewardItem[]
}

interface HistoryResponse {
  entries?: TeamRewardHistoryEntry[]
}

interface LevelResponse {
  currentLevel: number
  currentRule: any
  nextRule: any
  levelProgress: any
  teamStats: any
  allRules: any[]
  directActiveCount: number
  totalActiveDirects: number
  lastLevelUpAt: string | null
  message: string
}

interface MeResponse {
  user?: {
    id: string
    name: string
    email: string
    referralCode: string
    role?: string
    profileAvatar?: string
  }
}

interface AvailableToClaimCardProps {
  items: PendingRewardItem[]
  isLoading: boolean
  onClaim: () => void
  isClaiming: boolean
}

function AvailableToClaimCard({ items, isLoading, onClaim, isClaiming }: AvailableToClaimCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg">Available to Claim</CardTitle>
          <p className="text-sm text-muted-foreground">
            Review unclaimed team earnings. Claiming will credit the payout amount to your wallet balance.
          </p>
        </div>
        <Button onClick={onClaim} disabled={isClaiming || items.length === 0}>
          {isClaiming ? "Claiming..." : "Claim all"}
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
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  No team earnings are waiting to be claimed right now. New rewards will appear here when your team earns.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const createdDisplay = `${formatDate(item.createdAt, "long")} ${formatTime(item.createdAt)}`
                const percentDisplay = `${item.percent.toFixed(2)}%`
                const sourceDisplay = item.payer?.name ?? item.payer?.email ?? (item.payer?.id ? `User ${item.payer.id.slice(-6)}` : "Unknown")

                return (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap">{createdDisplay}</TableCell>
                    <TableCell className="whitespace-nowrap">{sourceDisplay}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {item.type === "TEAM_EARN_L1" ? "Team earning (L1)" : "Team earning (L2)"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">{formatCurrency(item.baseAmount)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">{percentDisplay}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">{formatCurrency(item.amount)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <Button variant="outline" size="sm" onClick={onClaim} disabled={isClaiming}>
                        Claim
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

  const { data: meData } = useSWR<MeResponse>("/api/auth/me", fetcher, {
    revalidateOnFocus: false,
  })

  const user = meData?.user

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
  } = useSWR<LevelResponse>(user ? "/api/levels/eligibility" : null, fetcher, {
    revalidateOnFocus: false,
  })

  const [isClaiming, setIsClaiming] = useState(false)

  const handleClaimRewards = async () => {
    if (isClaiming) return

    setIsClaiming(true)
    try {
      const response = await fetch("/api/team/rewards", { method: "POST", credentials: "include" })
      const data = (await response.json().catch(() => ({}))) as RewardsResponse & { error?: string }

      if (!response.ok) {
        toast({
          variant: "destructive",
          title: "Unable to claim rewards",
          description: data.error || "Please try again in a moment.",
        })
        return
      }

      await Promise.all([mutateRewards(), mutateHistory()])

      toast({
        title: "Rewards added to balance",
        description: `Successfully claimed ${formatCurrency(data.creditedAmount ?? 0)}.`,
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
        available: rewardsData.available ?? 0,
        claimedTotal: rewardsData.claimedTotal ?? 0,
        lastClaimedAt: rewardsData.lastClaimedAt ?? null,
        pending: rewardsData.pending ?? [],
      }
    : null

  const levelContent = (() => {
    if (levelLoading) {
      return <LevelProgressSkeleton />
    }

    if (levelError) {
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
          levelProgress={levelData.levelProgress}
          teamStats={levelData.teamStats}
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
  })()

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <Sidebar user={user ?? undefined} />

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

              <TeamList userId={user?.id} />
            </TabsContent>

            <TabsContent value="levels" className="space-y-6">
              {levelContent}
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
