"use client"

import { useEffect, useRef, useState } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { Trophy, Users, Target } from "lucide-react"

type OverrideKind = "daily_override" | "team_commission" | "team_reward"

interface OverrideSummary {
  kind: OverrideKind
  pct: number
  payout: "commission" | "reward"
  teams: string[]
}

const overrideKindLabels: Record<OverrideKind, string> = {
  daily_override: "Daily Override",
  team_commission: "Team Commission",
  team_reward: "Team Reward",
}

const overrideKindOrder: OverrideKind[] = [
  "daily_override",
  "team_commission",
  "team_reward",
]

function buildOverrideSummaries(rule: any): OverrideSummary[] {
  if (!rule?.teamOverrides?.length) return []

  const map = new Map<string, OverrideSummary>()
  for (const override of rule.teamOverrides as any[]) {
    if (!override?.pct || !override?.team) continue
    const kind = (override?.kind as OverrideKind | undefined) ??
      ((override?.payout as string) === "reward" ? "team_reward" : "team_commission")
    const key = `${kind}:${override.pct}:${override.payout}`
    const entry = map.get(key) ?? {
      kind,
      pct: override.pct as number,
      payout: override.payout as "commission" | "reward",
      teams: [],
    }

    if (!entry.teams.includes(override.team)) {
      entry.teams.push(override.team as string)
    }

    map.set(key, entry)
  }

  const summaries = Array.from(map.values()).map((summary) => ({
    ...summary,
    teams: summary.teams
      .map((team) => `Team ${team}`)
      .sort((a, b) => a.localeCompare(b)),
  }))

  summaries.sort(
    (a, b) => overrideKindOrder.indexOf(a.kind) - overrideKindOrder.indexOf(b.kind),
  )

  return summaries
}

interface LevelProgressProps {
  currentLevel: number
  levelProgress: {
    currentActive: number
    requiredActive: number
    progress: number
    nextLevel: number
  } | null
  teamStats: {
    totalMembers: number
    activeMembers: number
    directReferrals: number
    directActive: number
    totalTeamDeposits: number
    totalTeamEarnings: number
  }
  currentRule: any
  nextRule: any
  directActiveCount: number
  totalActiveDirects: number
  lastLevelUpAt: string | null
  message: string
}

export function LevelProgress({
  currentLevel,
  levelProgress,
  teamStats,
  currentRule,
  nextRule,
  directActiveCount,
  totalActiveDirects,
  lastLevelUpAt,
  message,
}: LevelProgressProps) {
  const currentOverrides = buildOverrideSummaries(currentRule)
  const nextOverrides = buildOverrideSummaries(nextRule)
  const [levelHighlight, setLevelHighlight] = useState(false)
  const [progressHighlight, setProgressHighlight] = useState(false)
  const previousLevelRef = useRef(currentLevel)
  const previousProgressRef = useRef(levelProgress?.currentActive ?? 0)

  useEffect(() => {
    if (previousLevelRef.current === currentLevel) {
      return
    }

    previousLevelRef.current = currentLevel
    setLevelHighlight(true)
    const timeout = window.setTimeout(() => setLevelHighlight(false), 900)
    return () => window.clearTimeout(timeout)
  }, [currentLevel])

  useEffect(() => {
    const currentActive = levelProgress?.currentActive ?? 0
    if (previousProgressRef.current === currentActive) {
      return
    }

    previousProgressRef.current = currentActive
    setProgressHighlight(true)
    const timeout = window.setTimeout(() => setProgressHighlight(false), 700)
    return () => window.clearTimeout(timeout)
  }, [levelProgress?.currentActive])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Current Level Status */}
      <Card
        className={cn(
          "transition-all duration-500",
          levelHighlight
            ? "ring-2 ring-amber-300/60 shadow-xl shadow-amber-200/30"
            : "ring-1 ring-transparent",
        )}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-600" />
            Current Level Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold">Level {currentLevel}</span>
            <Badge variant={currentLevel > 0 ? "default" : "secondary"} className="text-lg px-3 py-1">
              {currentLevel === 0 ? "Starter" : `Level ${currentLevel}`}
            </Badge>
          </div>

          {currentRule && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Direct Commission:</span>
                <span className="font-medium">{currentRule.directPct}%</span>
              </div>
              {currentOverrides.map((summary) => (
                <div key={`${summary.kind}-${summary.pct}`} className="flex justify-between">
                  <span className="text-muted-foreground">
                    {overrideKindLabels[summary.kind]}:
                  </span>
                  <span className="font-medium">
                    {summary.pct}% ({summary.teams.join(", ")})
                  </span>
                </div>
              ))}
              {currentOverrides.length === 0 && currentRule.teamRewardPct > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Team Reward:</span>
                  <span className="font-medium">{currentRule.teamRewardPct}%</span>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div
              className={cn(
                "rounded-lg border bg-muted/40 p-3 transition-all duration-500",
                progressHighlight
                  ? "border-primary/60 bg-primary/5 shadow-inner shadow-primary/20"
                  : "",
              )}
            >
              <p className="text-muted-foreground">Direct active referrals (current cycle)</p>
              <p className="text-lg font-semibold">
                {directActiveCount}
                {levelProgress ? ` / ${levelProgress.requiredActive}` : ""}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-muted-foreground">Total qualified direct referrals</p>
              <p className="text-lg font-semibold">{totalActiveDirects}</p>
            </div>
            <div className="rounded-lg border bg-muted/40 p-3 sm:col-span-2">
              <p className="text-muted-foreground">Last level up</p>
              <p className="text-lg font-semibold">
                {lastLevelUpAt ? new Date(lastLevelUpAt).toLocaleString() : "No level ups yet"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Next Level Progress */}
      {levelProgress && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              Next Level Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">Level {levelProgress.nextLevel}</span>
              <span className="text-sm text-muted-foreground">
                {levelProgress.currentActive} / {levelProgress.requiredActive} Active Members
              </span>
            </div>

            <Progress value={levelProgress.progress} className="h-3" />

            <div className="text-sm text-center text-muted-foreground">
              {levelProgress.progress >= 100 ? (
                <span className="text-green-600 font-medium">Requirements met! Level will update soon.</span>
              ) : (
                <span>{levelProgress.requiredActive - levelProgress.currentActive} more active members needed</span>
              )}
            </div>

            <Alert variant="secondary" className="text-left">
              <AlertDescription>{message}</AlertDescription>
            </Alert>

            {nextRule && (
              <div className="space-y-2 text-sm border-t pt-3">
                <h4 className="font-medium">Level {levelProgress.nextLevel} Benefits:</h4>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Direct Commission:</span>
                    <span className="font-medium text-green-600">
                      {nextRule.directPct}% (+{nextRule.directPct - (currentRule?.directPct || 7)}%)
                    </span>
                  </div>
                  {nextOverrides.map((summary) => (
                    <div key={`${summary.kind}-${summary.pct}`} className="flex justify-between">
                      <span className="text-muted-foreground">
                        {overrideKindLabels[summary.kind]}:
                      </span>
                      <span className="font-medium text-green-600">
                        {summary.pct}% ({summary.teams.join(", ")})
                      </span>
                    </div>
                  ))}
                  {nextRule.monthlyTargets?.bonus > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monthly Bonus:</span>
                      <span className="font-medium text-green-600">${nextRule.monthlyTargets.bonus}</span>
                    </div>
                  )}
                  {nextRule.monthlyTargets?.salary > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monthly Salary:</span>
                      <span className="font-medium text-green-600">${nextRule.monthlyTargets.salary}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Team Statistics */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-600" />
            Team Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{teamStats.totalMembers}</div>
              <div className="text-sm text-muted-foreground">Total Members</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-green-600">{teamStats.activeMembers}</div>
              <div className="text-sm text-muted-foreground">Active Members</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{teamStats.directReferrals}</div>
              <div className="text-sm text-muted-foreground">Direct Referrals</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-amber-600">${teamStats.totalTeamDeposits.toFixed(0)}</div>
              <div className="text-sm text-muted-foreground">Team Deposits</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
