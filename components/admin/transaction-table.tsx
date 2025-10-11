"use client"

import { type CSSProperties, useCallback, useEffect, useMemo, useState } from "react"
import debounce from "lodash.debounce"
import { FixedSizeList as List, type ListOnItemsRenderedProps } from "react-window"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, RefreshCw, Download, Eye, Check, X } from "lucide-react"
import type { AdminTransactionRecord } from "@/lib/types/admin"

const ROW_HEIGHT = 112
const VIRTUAL_LIST_HEIGHT = 540

export interface TransactionFilters {
  status?: string
  type?: string
  from?: string
  to?: string
  q?: string
}

interface TransactionTableProps {
  items: AdminTransactionRecord[]
  loading: boolean
  error?: string | null
  hasMore: boolean
  onLoadMore: () => void
  onRefresh: () => void
  onExport: () => void
  filters: TransactionFilters
  onFiltersChange: (filters: TransactionFilters) => void
}

export function TransactionTable({
  items,
  loading,
  error,
  hasMore,
  onLoadMore,
  onRefresh,
  onExport,
  filters,
  onFiltersChange,
}: TransactionTableProps) {
  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        onFiltersChange({ ...filters, q: value || undefined })
      }, 300),
    [filters, onFiltersChange],
  )

  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<AdminTransactionRecord | null>(null)
  const [txHash, setTxHash] = useState("")
  const [rejectionReason, setRejectionReason] = useState("")
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(null)
  const [giftBoxActionState, setGiftBoxActionState] = useState<{
    id: string
    action: "approve" | "reject"
  } | null>(null)
  const [giftBoxActionError, setGiftBoxActionError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      debouncedSearch.cancel()
    }
  }, [debouncedSearch])

  const handleItemsRendered = useCallback(
    ({ visibleStopIndex }: ListOnItemsRenderedProps) => {
      if (hasMore && !loading && visibleStopIndex >= items.length - 5) {
        onLoadMore()
      }
    },
    [hasMore, loading, items.length, onLoadMore],
  )

  const openDetails = useCallback((transaction: AdminTransactionRecord) => {
    setSelectedTransaction(transaction)
    setTxHash(typeof transaction.meta?.transactionHash === "string" ? transaction.meta.transactionHash : "")
    setRejectionReason(typeof transaction.meta?.rejectionReason === "string" ? transaction.meta.rejectionReason : "")
    setActionError(null)
    setPendingAction(null)
    setActionLoading(false)
    setDetailOpen(true)
  }, [])

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      setDetailOpen(open)
      if (!open) {
        setSelectedTransaction(null)
        setTxHash("")
        setRejectionReason("")
        setActionError(null)
        setPendingAction(null)
        setActionLoading(false)
      }
    },
    [],
  )

  const renderMetaValue = useCallback((value: unknown) => {
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground">—</span>
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return <span className="break-words">{String(value)}</span>
    }
    if (Array.isArray(value)) {
      return (
        <div className="space-y-2">
          {value.map((item, index) => (
            <pre key={index} className="overflow-x-auto rounded bg-muted/50 p-2 text-xs font-mono">
              {JSON.stringify(item, null, 2)}
            </pre>
          ))}
        </div>
      )
    }
    if (typeof value === "object") {
      const record = value as Record<string, unknown>
      return (
        <div className="space-y-2">
          {typeof record.url === "string" ? (
            <a
              href={record.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary underline"
            >
              View attachment
            </a>
          ) : null}
          <pre className="overflow-x-auto rounded bg-muted/50 p-2 text-xs font-mono">
            {JSON.stringify(record, null, 2)}
          </pre>
        </div>
      )
    }
    return <span className="break-words">{String(value)}</span>
  }, [])

  const handleApprove = useCallback(async () => {
    if (!selectedTransaction) return
    if (selectedTransaction.status !== "pending") {
      setActionError("Only pending transactions can be approved.")
      return
    }
    if (!["deposit", "withdraw"].includes(selectedTransaction.type)) {
      setActionError("This transaction type cannot be approved manually.")
      return
    }

    setPendingAction("approve")
    setActionLoading(true)
    setActionError(null)

    try {
      const endpoint =
        selectedTransaction.type === "deposit"
          ? "/api/admin/approve-deposit"
          : "/api/admin/approve-withdraw"
      const payload: Record<string, unknown> = { transactionId: selectedTransaction._id }
      if (selectedTransaction.type === "withdraw" && txHash.trim()) {
        payload.txHash = txHash.trim()
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Failed to approve transaction")
      }

      await Promise.resolve(onRefresh())
      handleDialogOpenChange(false)
    } catch (exception) {
      setActionError(exception instanceof Error ? exception.message : "Unable to approve transaction")
    } finally {
      setPendingAction(null)
      setActionLoading(false)
    }
  }, [handleDialogOpenChange, onRefresh, selectedTransaction, txHash])

  const handleReject = useCallback(async () => {
    if (!selectedTransaction) return
    if (selectedTransaction.status !== "pending") {
      setActionError("Only pending transactions can be rejected.")
      return
    }

    setPendingAction("reject")
    setActionLoading(true)
    setActionError(null)

    try {
      const response = await fetch("/api/admin/reject-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: selectedTransaction._id,
          reason: rejectionReason.trim(),
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Failed to reject transaction")
      }

      await Promise.resolve(onRefresh())
      handleDialogOpenChange(false)
    } catch (exception) {
      setActionError(exception instanceof Error ? exception.message : "Unable to reject transaction")
    } finally {
      setPendingAction(null)
      setActionLoading(false)
    }
  }, [handleDialogOpenChange, onRefresh, rejectionReason, selectedTransaction])

  const handleGiftBoxDecision = useCallback(
    async (transaction: AdminTransactionRecord, depositId: string, action: "approve" | "reject") => {
      if (transaction.type !== "giftBoxDeposit") {
        return
      }

      if (transaction.status !== "pending") {
        setGiftBoxActionError("Only pending Gift Box deposits can be reviewed.")
        return
      }

      if (!depositId) {
        setGiftBoxActionError("Missing Gift Box deposit identifier for this transaction.")
        return
      }

      setGiftBoxActionError(null)
      setGiftBoxActionState({ id: transaction._id, action })

      try {
        const endpoint =
          action === "approve"
            ? `/api/admin/giftbox/deposits/${depositId}/approve`
            : `/api/admin/giftbox/deposits/${depositId}/reject`

        const response = await fetch(endpoint, { method: "POST" })

        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(
            data.error || `Failed to ${action === "approve" ? "accept" : "reject"} the Gift Box deposit`,
          )
        }

        await Promise.resolve(onRefresh())
      } catch (error) {
        setGiftBoxActionError(
          error instanceof Error ? error.message : "Unable to process the Gift Box deposit action.",
        )
      } finally {
        setGiftBoxActionState(null)
      }
    },
    [onRefresh],
  )

  const selectedIsActionable =
    selectedTransaction?.status === "pending" &&
    (selectedTransaction?.type === "deposit" || selectedTransaction?.type === "withdraw")

  const requiresTxHash = selectedTransaction?.type === "withdraw"

  const additionalMetaEntries = useMemo(() => {
    if (!selectedTransaction?.meta || typeof selectedTransaction.meta !== "object") {
      return [] as Array<[string, unknown]>
    }
    return Object.entries(selectedTransaction.meta).filter(([key]) => key !== "transactionHash")
  }, [selectedTransaction])

  const renderRow = useCallback(
    ({ index, style }: { index: number; style: CSSProperties }) => {
      const transaction = items[index]
      if (!transaction) {
        return null
      }

      const isGiftBoxDeposit = transaction.type === "giftBoxDeposit"
      const requiresAction =
        transaction.status === "pending" &&
        (transaction.type === "deposit" || transaction.type === "withdraw" || isGiftBoxDeposit)
      const giftBoxDepositId =
        isGiftBoxDeposit && typeof transaction.meta?.depositId === "string"
          ? (transaction.meta.depositId as string)
          : null
      const isGiftBoxActionLoading = giftBoxActionState?.id === transaction._id
      const isGiftBoxApproving = isGiftBoxActionLoading && giftBoxActionState?.action === "approve"
      const isGiftBoxRejecting = isGiftBoxActionLoading && giftBoxActionState?.action === "reject"

      return (
        <div
          key={transaction._id}
          style={style}
          className="flex flex-col gap-4 border-b px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between md:grid md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] md:gap-4"
        >
          <div className="space-y-3 text-left md:col-span-2">
            <div className="font-medium">{transaction.userId?.name || "Unknown"}</div>
            <div className="text-xs text-muted-foreground">{transaction.userId?.email}</div>
            <div className="text-xs font-mono text-muted-foreground">{transaction._id}</div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground md:hidden">
              <span className="flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">
                  {transaction.type}
                </Badge>
                <span>${transaction.amount.toFixed(2)}</span>
              </span>
              <span className="capitalize">{transaction.status}</span>
              <span>{new Date(transaction.createdAt).toLocaleString()}</span>
            </div>
          </div>
          <div className="hidden md:block">
            <Badge variant="secondary" className="capitalize">
              {transaction.type}
            </Badge>
          </div>
          <div className="hidden font-mono md:block">${transaction.amount.toFixed(2)}</div>
          <div className="hidden md:block">
            <Badge
              variant={
                transaction.status === "approved"
                  ? "default"
                  : transaction.status === "pending"
                    ? "secondary"
                    : "destructive"
              }
              className="capitalize"
            >
              {transaction.status}
            </Badge>
          </div>
          <div className="hidden text-xs text-muted-foreground md:block">
            {new Date(transaction.createdAt).toLocaleString()}
          </div>
          <div className="flex w-full flex-wrap items-center justify-center gap-2 md:w-auto md:justify-end md:pl-2">
            {requiresAction ? (
              <Badge variant="outline" className="uppercase">
                Action needed
              </Badge>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openDetails(transaction)}
              className="w-full justify-center gap-1 sm:w-auto md:w-auto"
            >
              <Eye className="h-4 w-4" /> Review
            </Button>
            {isGiftBoxDeposit && transaction.status === "pending" ? (
              <>
                <Button
                  size="sm"
                  onClick={() =>
                    giftBoxDepositId ? void handleGiftBoxDecision(transaction, giftBoxDepositId, "approve") : null
                  }
                  disabled={isGiftBoxActionLoading || !giftBoxDepositId}
                  className="w-full justify-center gap-1 md:w-auto"
                >
                  {isGiftBoxApproving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    giftBoxDepositId ? void handleGiftBoxDecision(transaction, giftBoxDepositId, "reject") : null
                  }
                  disabled={isGiftBoxActionLoading || !giftBoxDepositId}
                  className="w-full justify-center gap-1 md:w-auto"
                >
                  {isGiftBoxRejecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Reject
                </Button>
              </>
            ) : null}
          </div>
        </div>
      )
    },
    [giftBoxActionState, handleGiftBoxDecision, items, openDetails],
  )

  return (
    <Card className="space-y-4">
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <CardTitle className="text-2xl font-semibold">Transactions</CardTitle>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={onRefresh} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
          </Button>
          <Button onClick={onExport} variant="default" className="gap-2">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {giftBoxActionError ? (
          <Alert variant="destructive">
            <AlertDescription>{giftBoxActionError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="transaction-search">Search by email or ID</Label>
            <Input
              id="transaction-search"
              placeholder="user@example.com"
              defaultValue={filters.q}
              onChange={(event) => debouncedSearch(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={filters.status ?? "all"}
              onValueChange={(value) => onFiltersChange({ ...filters, status: value === "all" ? undefined : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={filters.type ?? "all"}
              onValueChange={(value) => onFiltersChange({ ...filters, type: value === "all" ? undefined : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="deposit">Deposit</SelectItem>
                <SelectItem value="withdraw">Withdraw</SelectItem>
                <SelectItem value="earn">Earnings</SelectItem>
                <SelectItem value="commission">Commission</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="transaction-from">From</Label>
              <Input
                id="transaction-from"
                type="date"
                value={filters.from ?? ""}
                onChange={(event) => onFiltersChange({ ...filters, from: event.target.value || undefined })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transaction-to">To</Label>
              <Input
                id="transaction-to"
                type="date"
                value={filters.to ?? ""}
                onChange={(event) => onFiltersChange({ ...filters, to: event.target.value || undefined })}
              />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-md border">
          <div className="flex items-center justify-between bg-muted px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:hidden">
            <span>User</span>
            <span>Actions</span>
          </div>
          <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] items-center gap-4 bg-muted px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
            <span className="col-span-2">User</span>
            <span>Type</span>
            <span>Amount</span>
            <span>Status</span>
            <span>Date</span>
            <span className="text-right">Actions</span>
          </div>
          <div style={{ height: VIRTUAL_LIST_HEIGHT }}>
            <List
              height={VIRTUAL_LIST_HEIGHT}
              itemCount={items.length}
              itemSize={ROW_HEIGHT}
              width="100%"
              onItemsRendered={handleItemsRendered}
            >
              {renderRow}
            </List>
            {loading && (
              <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading
              </div>
            )}
            {!loading && items.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">No transactions found.</div>
            )}
          </div>
        </div>
      </CardContent>
      <Dialog open={detailOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-h-[95vh] w-full max-w-4xl overflow-y-auto space-y-6">
          <DialogHeader>
            <DialogTitle>Transaction details</DialogTitle>
            <DialogDescription>Review the request and approve or reject it from this panel.</DialogDescription>
          </DialogHeader>

          {selectedTransaction ? (
            <div className="space-y-6 text-sm">
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">User</h4>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Name</div>
                    <div className="font-medium">{selectedTransaction.userId?.name || "Unknown"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Email</div>
                    <div className="break-all text-muted-foreground">{selectedTransaction.userId?.email || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">User ID</div>
                    <div className="font-mono text-xs">{selectedTransaction.userId?._id || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Referral code</div>
                    <div className="text-muted-foreground">{selectedTransaction.userId?.referralCode || "—"}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">Transaction</h4>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Type</div>
                    <div className="capitalize">{selectedTransaction.type}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Status</div>
                    <Badge
                      variant={
                        selectedTransaction.status === "approved"
                          ? "default"
                          : selectedTransaction.status === "pending"
                            ? "secondary"
                            : "destructive"
                      }
                      className="capitalize"
                    >
                      {selectedTransaction.status}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Amount</div>
                    <div className="font-mono text-base font-semibold">${selectedTransaction.amount.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Created at</div>
                    <div>{new Date(selectedTransaction.createdAt).toLocaleString()}</div>
                  </div>
                  {selectedTransaction.meta?.transactionHash ? (
                    <div className="md:col-span-2">
                      <div className="text-xs uppercase text-muted-foreground">Transaction hash</div>
                      <div className="break-all font-mono text-xs">
                        {String(selectedTransaction.meta.transactionHash)}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">Additional details</h4>
                {additionalMetaEntries.length ? (
                  <div className="space-y-3">
                    {additionalMetaEntries.map(([key, value]) => (
                      <div key={key} className="space-y-1 rounded border p-3">
                        <div className="text-xs font-medium uppercase text-muted-foreground">{key}</div>
                        <div className="text-sm leading-relaxed">{renderMetaValue(value)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No additional metadata available.</p>
                )}
              </div>

              {selectedIsActionable ? (
                <div className="space-y-4">
                  {requiresTxHash ? (
                    <div className="space-y-2">
                      <Label htmlFor="admin-transaction-hash">Transaction hash</Label>
                      <Input
                        id="admin-transaction-hash"
                        value={txHash}
                        onChange={(event) => setTxHash(event.target.value)}
                        placeholder="Optional blockchain hash"
                      />
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    <Label htmlFor="admin-transaction-reason">Rejection reason</Label>
                    <Textarea
                      id="admin-transaction-reason"
                      value={rejectionReason}
                      onChange={(event) => setRejectionReason(event.target.value)}
                      placeholder="Optional explanation shared with the user"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a transaction to view its details.</p>
          )}

          {actionError ? (
            <Alert variant="destructive">
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" onClick={() => handleDialogOpenChange(false)} disabled={actionLoading}>
              Close
            </Button>
            {selectedIsActionable ? (
              <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReject}
                  disabled={actionLoading}
                  className="gap-1"
                >
                  {pendingAction === "reject" && actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                  Reject
                </Button>
                <Button type="button" onClick={handleApprove} disabled={actionLoading} className="gap-1">
                  {pendingAction === "approve" && actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Approve
                </Button>
              </div>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
