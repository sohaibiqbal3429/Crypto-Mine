"use client"

import { useMemo } from "react"
import { format } from "date-fns"
import { Check, X } from "lucide-react"

import type { DepositStatus, LuckyDrawDeposit } from "@/lib/types/lucky-draw"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface AdminDepositsTableProps {
  deposits: LuckyDrawDeposit[]
  onAccept: (depositId: string) => void
  onReject: (depositId: string) => void
}

export function AdminDepositsTable({ deposits, onAccept, onReject }: AdminDepositsTableProps) {
  const summary = useMemo(() => {
    const pending = deposits.filter((deposit) => deposit.status === "PENDING").length
    const accepted = deposits.filter((deposit) => deposit.status === "ACCEPTED").length
    const rejected = deposits.filter((deposit) => deposit.status === "REJECTED").length
    return { pending, accepted, rejected }
  }, [deposits])

  const renderStatusBadge = (status: DepositStatus) => {
    switch (status) {
      case "ACCEPTED":
        return <Badge className="bg-emerald-500/15 text-emerald-600">Accepted</Badge>
      case "REJECTED":
        return <Badge className="bg-rose-500/15 text-rose-500">Rejected</Badge>
      default:
        return <Badge className="bg-amber-500/15 text-amber-500">Pending Review</Badge>
    }
  }

  const isUrl = (value: string) => value.startsWith("http") || value.startsWith("blob:")

  return (
    <Card className="border-0 bg-gradient-to-br from-slate-900/10 via-slate-900/5 to-slate-900/10 shadow-lg">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg font-semibold">Deposit Reviews</CardTitle>
          <p className="text-sm text-muted-foreground">
            Review $10 BEP20 deposits submitted for the Blind Box Lucky Draw and approve eligible entries.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="border-amber-400/40 text-amber-500">
            Pending: {summary.pending}
          </Badge>
          <Badge variant="outline" className="border-emerald-400/40 text-emerald-500">
            Accepted: {summary.accepted}
          </Badge>
          <Badge variant="outline" className="border-rose-400/40 text-rose-500">
            Rejected: {summary.rejected}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Tx Hash</TableHead>
              <TableHead>Receipt</TableHead>
              <TableHead>Submitted At (UTC)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deposits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  No deposits submitted for review yet.
                </TableCell>
              </TableRow>
            ) : (
              deposits.map((deposit) => (
                <TableRow key={deposit.id} className="bg-background/50">
                  <TableCell className="font-medium">
                    {deposit.userName ?? "Unknown participant"}
                  </TableCell>
                  <TableCell className="break-all font-mono text-xs">{deposit.txHash}</TableCell>
                  <TableCell>
                    {isUrl(deposit.receiptReference) ? (
                      <Button variant="link" className="px-0" asChild>
                        <a href={deposit.receiptReference} target="_blank" rel="noopener noreferrer">
                          View Receipt
                        </a>
                      </Button>
                    ) : (
                      <span className="break-all text-xs text-muted-foreground">{deposit.receiptReference}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(deposit.submittedAt), "MMM d, yyyy • HH:mm:ss")}
                  </TableCell>
                  <TableCell>{renderStatusBadge(deposit.status)}</TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-emerald-400/40 text-emerald-600"
                      disabled={deposit.status !== "PENDING"}
                      onClick={() => onAccept(deposit.id)}
                    >
                      <Check className="mr-1 h-4 w-4" /> Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-rose-400/40 text-rose-500"
                      disabled={deposit.status !== "PENDING"}
                      onClick={() => onReject(deposit.id)}
                    >
                      <X className="mr-1 h-4 w-4" /> Reject
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
