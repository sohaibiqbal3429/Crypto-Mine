"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency, formatDate, formatTime } from "@/lib/utils/formatting"

export interface TeamRewardHistoryEntry {
  id: string
  type: "TEAM_EARN_L1" | "TEAM_EARN_L2"
  amount: number
  percent: number
  baseAmount: number
  createdAt: string
  claimedAt: string
  sourceTxId: string
  payer: { id: string; name: string | null; email: string | null } | null
}

interface TeamRewardsHistoryProps {
  entries: TeamRewardHistoryEntry[]
  isLoading: boolean
}

function formatPayer(entry: TeamRewardHistoryEntry) {
  if (entry.payer?.name) return entry.payer.name
  if (entry.payer?.email) return entry.payer.email
  if (entry.payer?.id) return `User ${entry.payer.id.slice(-6)}`
  return "Unknown"
}

function formatPercent(value: number) {
  const rounded = Number.parseFloat(value.toFixed(2))
  return `${rounded}%`
}

function formatType(type: TeamRewardHistoryEntry["type"]) {
  return type === "TEAM_EARN_L1" ? "Team Earning (L1)" : "Team Earning (L2)"
}

export function TeamRewardsHistory({ entries, isLoading }: TeamRewardsHistoryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Daily Rewards History</CardTitle>
        <p className="text-sm text-muted-foreground">
          Claimed team earnings appear here with the original earnings amount and payout rate.
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Claimed</TableHead>
              <TableHead className="whitespace-nowrap">Source User</TableHead>
              <TableHead className="whitespace-nowrap">Type</TableHead>
              <TableHead className="whitespace-nowrap text-right">Base Amount</TableHead>
              <TableHead className="whitespace-nowrap text-right">Percent</TableHead>
              <TableHead className="whitespace-nowrap text-right">Payout</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <TableRow key={`loading-${index}`}>
                  <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-20" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-16" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-24" /></TableCell>
                </TableRow>
              ))
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No claimed rewards yet. Claim your available team earnings to populate this history.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => {
                const claimedDate = `${formatDate(entry.claimedAt, "long")} ${formatTime(entry.claimedAt)}`
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">{claimedDate}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatPayer(entry)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatType(entry.type)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">{formatCurrency(entry.baseAmount)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">{formatPercent(entry.percent)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">{formatCurrency(entry.amount)}</TableCell>
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
