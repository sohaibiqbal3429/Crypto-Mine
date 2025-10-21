"use client"

import { useMemo } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate, formatTime } from "@/lib/utils/formatting"

export type TeamRewardHistoryCategory =
  | "claim"
  | "team_reward"
  | "team_commission"
  | "daily_profit"
  | "daily_team_earning"
  | "deposit_commission"
  | "bonus"
  | "salary"
  | "other"

export interface TeamRewardHistoryEntry {
  id: string
  occurredAt: string
  amount: number
  status: string
  category: TeamRewardHistoryCategory
  description: string
  team: string | null
  teams: string[] | null
  rate: number | null
  level: number | null
  sourceUserId: string | null
  sourceUserName: string | null
  transactionType: string
  baseAmount: number | null
}

interface TeamRewardsHistoryProps {
  entries: TeamRewardHistoryEntry[]
  isLoading: boolean
}

const CATEGORY_BADGE: Record<
  TeamRewardHistoryCategory,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  claim: { label: "Claim", variant: "default" },
  team_reward: { label: "Team reward", variant: "secondary" },
  team_commission: { label: "Team commission", variant: "secondary" },
  daily_profit: { label: "Daily profit", variant: "secondary" },
  daily_team_earning: { label: "Daily team earning", variant: "secondary" },
  deposit_commission: { label: "Deposit commission", variant: "outline" },
  bonus: { label: "Monthly bonus", variant: "outline" },
  salary: { label: "Monthly salary", variant: "outline" },
  other: { label: "Team activity", variant: "outline" },
}

function formatSource(entry: TeamRewardHistoryEntry) {
  if (entry.sourceUserName) {
    return entry.sourceUserName
  }
  if (entry.sourceUserId) {
    return `User ${entry.sourceUserId.slice(-6)}`
  }
  return "—"
}

function formatTeam(entry: TeamRewardHistoryEntry) {
  if (entry.team) {
    return entry.team
  }
  if (entry.teams && entry.teams.length > 0) {
    return entry.teams.join(", ")
  }
  return "—"
}

function formatLevel(entry: TeamRewardHistoryEntry) {
  if (typeof entry.level === "number" && entry.level > 0) {
    return `L${entry.level}`
  }
  return "—"
}

function formatRate(entry: TeamRewardHistoryEntry) {
  if (typeof entry.rate === "number") {
    const rateValue = Number.isInteger(entry.rate) ? entry.rate : Number(entry.rate.toFixed(2))
    return `${rateValue}%`
  }
  return "—"
}

function formatBaseAmount(entry: TeamRewardHistoryEntry) {
  if (typeof entry.baseAmount === "number") {
    return `$${entry.baseAmount.toFixed(4)}`
  }
  return "—"
}

export function TeamRewardsHistory({ entries, isLoading }: TeamRewardsHistoryProps) {
  const content = useMemo(() => {
    if (isLoading) {
      return (
        <TableBody>
          {Array.from({ length: 4 }).map((_, index) => (
            <TableRow key={index}>
              <TableCell className="py-4">
                <div className="flex flex-col gap-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-28" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-10" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-12" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      )
    }

    if (!entries.length) {
      return (
        <TableBody>
          <TableRow>
            <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
              No reward activity recorded yet. Grow your team to start earning rewards.
            </TableCell>
          </TableRow>
        </TableBody>
      )
    }

    return (
      <TableBody>
        {entries.map((entry) => {
          const badge = CATEGORY_BADGE[entry.category] ?? CATEGORY_BADGE.other
          const date = formatDate(entry.occurredAt, "long")
          const time = formatTime(entry.occurredAt)

          return (
            <TableRow key={entry.id}>
              <TableCell className="py-4 align-top">
                <div className="flex flex-col">
                  <span className="font-medium">{date}</span>
                  <span className="text-xs text-muted-foreground">{time}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-sm">{formatSource(entry)}</span>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                    <span>{entry.description}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell>{formatTeam(entry)}</TableCell>
              <TableCell>{formatLevel(entry)}</TableCell>
              <TableCell className="font-mono text-sm">{formatBaseAmount(entry)}</TableCell>
              <TableCell>{formatRate(entry)}</TableCell>
              <TableCell className="font-semibold text-right">{`$${entry.amount.toFixed(4)}`}</TableCell>
              <TableCell>
                <Badge variant={entry.status === "approved" || entry.status === "posted" ? "secondary" : "outline"}>
                  {entry.status}
                </Badge>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    )
  }, [entries, isLoading])

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-lg">Rewards History</CardTitle>
        <p className="text-sm text-muted-foreground">
          Track commissions, team rewards, bonuses, and claims generated by your team.
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Base profit</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          {content}
        </Table>
      </CardContent>
    </Card>
  )
}

