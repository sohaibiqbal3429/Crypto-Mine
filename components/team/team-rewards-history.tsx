"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency, formatDate, formatTime } from "@/lib/utils/formatting"
import { ensureDate, ensureNumber } from "@/lib/utils/safe-parsing"

export interface TeamRewardHistoryEntry {
  id?: string
  type?: "TEAM_EARN_L1" | "TEAM_EARN_L2"
  amount?: number
  percent?: number
  baseAmount?: number
  createdAt?: string
  claimedAt?: string
  sourceTxId?: string
  payer?: { id?: string | null; name?: string | null; email?: string | null } | null
}

interface TeamRewardsHistoryProps {
  entries: TeamRewardHistoryEntry[]
  isLoading: boolean
}

function formatPayer(entry: TeamRewardHistoryEntry) {
  const payer = entry.payer ?? null
  if (!payer) return "Unknown"

  if (typeof payer.name === "string" && payer.name.trim().length > 0) return payer.name
  if (typeof payer.email === "string" && payer.email.trim().length > 0) return payer.email
  if (typeof payer.id === "string" && payer.id.length > 0) return `User ${payer.id.slice(-6)}`
  return "Unknown"
}

function formatPercent(value: number) {
  const rounded = ensureNumber(value, Number.NaN)
  if (!Number.isFinite(rounded)) {
    return "N/A"
  }

  return `${Number.parseFloat(rounded.toFixed(2))}%`
}

function formatType(type: TeamRewardHistoryEntry["type"]) {
  if (type === "TEAM_EARN_L1") return "Team Earning (L1)"
  if (type === "TEAM_EARN_L2") return "Team Earning (L2)"
  return "Team Earning"
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
              entries.map((entry, index) => {
                const claimedAt = ensureDate(entry.claimedAt)
                const claimedDate = claimedAt
                  ? `${formatDate(claimedAt, "long")} ${formatTime(claimedAt)}`
                  : "Date unavailable"
                const baseAmount = ensureNumber(entry.baseAmount, 0)
                const amount = ensureNumber(entry.amount, 0)
                const percentDisplay = formatPercent(entry.percent ?? Number.NaN)
                const rowKey = typeof entry.id === "string" && entry.id.length > 0 ? entry.id : `history-${index}`

                return (
                  <TableRow key={rowKey}>
                    <TableCell className="whitespace-nowrap">{claimedDate}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatPayer(entry)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatType(entry.type)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">{formatCurrency(baseAmount)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">{percentDisplay}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">{formatCurrency(amount)}</TableCell>
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
