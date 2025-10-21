"use client"

import { useMemo } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency, formatDate, formatTime } from "@/lib/utils/formatting"

export type TeamRewardHistoryCategory =
  | "claim"
  | "team_reward"
  | "team_commission"
  | "daily_profit"
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
  rate: number | null
  level: number | null
  sourceUserId: string | null
  sourceUserName: string | null
  transactionType: string
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
  deposit_commission: { label: "Deposit commission", variant: "outline" },
  bonus: { label: "Monthly bonus", variant: "outline" },
  salary: { label: "Monthly salary", variant: "outline" },
  other: { label: "Team activity", variant: "outline" },
}

function formatDetail(entry: TeamRewardHistoryEntry) {
  const detailParts: string[] = []
  if (entry.team) {
    detailParts.push(`Team ${entry.team}`)
  }
  if (typeof entry.rate === "number") {
    const rateValue = Number.isInteger(entry.rate) ? entry.rate.toString() : entry.rate.toFixed(2)
    detailParts.push(`${rateValue}%`)
  }
  if (typeof entry.level === "number" && entry.level > 0) {
    detailParts.push(`Level ${entry.level}`)
  }

  return detailParts.length > 0 ? detailParts.join(" • ") : "—"
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
                <Skeleton className="h-5 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-28" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-16" />
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
            <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
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
              <TableCell className="py-4">
                <div className="flex flex-col">
                  <span className="font-medium">{date}</span>
                  <span className="text-xs text-muted-foreground">{time}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                  <span className="text-sm text-muted-foreground">{entry.description}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-sm">{formatSource(entry)}</span>
                  <span className="text-xs text-muted-foreground">{formatDetail(entry)}</span>
                </div>
              </TableCell>
              <TableCell className="font-semibold">{formatCurrency(entry.amount)}</TableCell>
              <TableCell>
                <Badge variant={entry.status === "approved" ? "secondary" : "outline"}>{entry.status}</Badge>
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
              <TableHead>Type</TableHead>
              <TableHead>Source &amp; details</TableHead>
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

