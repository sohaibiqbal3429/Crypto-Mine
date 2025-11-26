"use client"

import { useMemo } from "react"
import { format } from "date-fns"
import { Check, Loader2, RefreshCw, X } from "lucide-react"

import type { LuckyDrawDepositStatus, LuckyDrawDeposit } from "@/lib/types/lucky-draw"
import { ensureDate, ensureNumber } from "@/lib/utils/safe-parsing"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface AdminDepositsTableProps {
  deposits: LuckyDrawDeposit[]
  loading?: boolean
  error?: string | null
  onAccept: (depositId: string) => void
  onReject: (depositId: string) => void
  onRefresh?: () => void
}

export function AdminDepositsTable({
  deposits,
  loading = false,
  error = null,
  onAccept,
  onReject,
  onRefresh,
}: AdminDepositsTableProps) {
  const summary = useMemo(() => {
    const pending = deposits.filter((deposit) => deposit.status === "PENDING").length
    const approved = deposits.filter((deposit) => deposit.status === "APPROVED").length
    const rejected = deposits.filter((deposit) => deposit.status === "REJECTED").length
    return { pending, approved, rejected }
  }, [deposits])

  const renderStatusBadge = (status: LuckyDrawDepositStatus) => {
    switch (status) {
      case "APPROVED":
        return <Badge className="bg-emerald-500/15 text-emerald-600">Approved</Badge>
      case "REJECTED":
        return <Badge className="bg-rose-500/15 text-rose-500">Rejected</Badge>
      default:
        return <Badge className="bg-amber-500/15 text-amber-500">Pending Review</Badge>
    }
  }

  const isUrl = (value: string) => value.startsWith("http") || value.startsWith("/")

  const renderReceipt = (deposit: LuckyDrawDeposit) => {
    if (deposit.receipt?.url) {
      return (
        <Button variant="link" className="px-0" asChild>
          <a href={deposit.receipt.url} target="_blank" rel="noopener noreferrer">
            View Receipt
          </a>
        </Button>
      )
    }

    if (deposit.receiptReference && isUrl(deposit.receiptReference)) {
      return (
        <Button variant="link" className="px-0" asChild>
          <a href={deposit.receiptReference} target="_blank" rel="noopener noreferrer">
            View Receipt
          </a>
        </Button>
      )
    }

    return deposit.receiptReference ? (
      <span className="break-all text-xs text-muted-foreground">{deposit.receiptReference}</span>
    ) : (
      <span className="text-xs text-muted-foreground">Not provided</span>
    )
  }

  return (
    <Card className="border-0 bg-gradient-to-br from-slate-900/10 via-slate-900/5 to-slate-900/10 py-5 shadow-lg">
      <CardHeader className="flex flex-col gap-3 px-5 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg font-semibold">Deposit Reviews</CardTitle>
          <p className="text-sm text-muted-foreground">
            Review $10 BEP20 deposits submitted for the Blind Box Lucky Draw and approve eligible entries.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="border-amber-400/40 text-amber-500">
            Pending: {summary.pending}
          </Badge>
          <Badge variant="outline" className="border-emerald-400/40 text-emerald-500">
            Approved: {summary.approved}
          </Badge>
          <Badge variant="outline" className="border-rose-400/40 text-rose-500">
            Rejected: {summary.rejected}
          </Badge>
          {onRefresh ? (
            <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={onRefresh} disabled={loading}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Refresh
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto px-5 pb-5">
        {error ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Receipt</TableHead>
              <TableHead>Submitted At (UTC)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading deposits…
                  </div>
                </TableCell>
              </TableRow>
            ) : deposits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  No deposits submitted for review yet.
                </TableCell>
              </TableRow>
            ) : (
              deposits.map((deposit) => {
                const amountUsd = ensureNumber(deposit.amountUsd, 0)
                const submittedAt = ensureDate(deposit.submittedAt)

                return (
                  <TableRow key={deposit.id} className="bg-background/50">
                    <TableCell className="font-medium">{deposit.userName ?? "Unknown participant"}</TableCell>
                    <TableCell>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="text-foreground">${amountUsd.toFixed(2)} submitted</div>
                      <div>
                        <span className="text-foreground">Tx:</span>{" "}
                        <span className="break-all font-mono">{deposit.txHash || "—"}</span>
                      </div>
                      <div>
                        <span className="text-foreground">Network:</span>{" "}
                        {deposit.network ? deposit.network : "—"}
                      </div>
                      <div>
                        <span className="text-foreground">Address:</span>{" "}
                        <span className="break-all font-mono">{deposit.depositAddress ?? "—"}</span>
                      </div>
                      {deposit.exchangePlatform ? (
                        <div>
                          <span className="text-foreground">Exchange:</span> {deposit.exchangePlatform}
                        </div>
                      ) : null}
                      {deposit.adminNote ? (
                        <div>
                          <span className="text-foreground">Admin note:</span>{" "}
                          <span className="break-all text-xs text-muted-foreground">{deposit.adminNote}</span>
                        </div>
                      ) : null}
                    </div>
                  </TableCell>
                    <TableCell>{renderReceipt(deposit)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {submittedAt ? format(submittedAt, "MMM d, yyyy • HH:mm:ss") : "Unknown"}
                    </TableCell>
                    <TableCell>{renderStatusBadge(deposit.status)}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-emerald-400/40 text-emerald-600"
                        disabled={deposit.status !== "PENDING" || loading}
                        onClick={() => onAccept(deposit.id)}
                      >
                        <Check className="mr-1 h-4 w-4" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-rose-400/40 text-rose-500"
                        disabled={deposit.status !== "PENDING" || loading}
                        onClick={() => onReject(deposit.id)}
                      >
                        <X className="mr-1 h-4 w-4" /> Reject
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
