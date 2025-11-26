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
import { ensureDate, ensureNumber } from "@/lib/utils/safe-parsing"

const ROW_HEIGHT = 112
const VIRTUAL_LIST_HEIGHT = 540

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return isMobile
}

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
  const isMobile = useIsMobile()

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
  

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch])

  const handleItemsRendered = useCallback(
    ({ visibleStopIndex }: ListOnItemsRenderedProps) => {
      if (hasMore && !loading && visibleStopIndex >= items.length - 5) onLoadMore()
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

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setDetailOpen(open)
    if (!open) {
      setSelectedTransaction(null)
      setTxHash("")
      setRejectionReason("")
      setActionError(null)
      setPendingAction(null)
      setActionLoading(false)
    }
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
        selectedTransaction.type === "deposit" ? "/api/admin/approve-deposit" : "/api/admin/approve-withdraw"
      const payload: Record<string, unknown> = { transactionId: selectedTransaction._id }
      if (selectedTransaction.type === "withdraw" && txHash.trim()) payload.txHash = txHash.trim()
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
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Unable to approve transaction")
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
        body: JSON.stringify({ transactionId: selectedTransaction._id, reason: rejectionReason.trim() }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Failed to reject transaction")
      }
      await Promise.resolve(onRefresh())
      handleDialogOpenChange(false)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Unable to reject transaction")
    } finally {
      setPendingAction(null)
      setActionLoading(false)
    }
  }, [handleDialogOpenChange, onRefresh, rejectionReason, selectedTransaction])

  

  const selectedIsActionable =
    selectedTransaction?.status === "pending" &&
    (selectedTransaction?.type === "deposit" || selectedTransaction?.type === "withdraw")
  const requiresTxHash = selectedTransaction?.type === "withdraw"
  const selectedAmount = selectedTransaction ? ensureNumber(selectedTransaction.amount, 0) : 0
  const selectedCreatedAt = selectedTransaction ? ensureDate(selectedTransaction.createdAt) : null
  const selectedCreatedAtLabel = selectedCreatedAt ? selectedCreatedAt.toLocaleString() : "Unknown"

  // ---- Row (desktop + mobile) ----
  const RowInner = useCallback(
    (transaction: AdminTransactionRecord) => {
      const amount = ensureNumber(transaction.amount, 0)
      const createdAt = ensureDate(transaction.createdAt)
      const createdAtLabel = createdAt ? createdAt.toLocaleString() : "Unknown"
      const requiresAction =
        transaction.status === "pending" &&
        (transaction.type === "deposit" || transaction.type === "withdraw")

      return (
        <>
          {/* User block */}
          <div className="space-y-3 text-left md:col-start-1 md:row-start-1">
            <div className="text-base font-semibold leading-tight">{transaction.userId?.name || "Unknown"}</div>
            <div className="text-xs text-muted-foreground">{transaction.userId?.email}</div>
            <div className="text-xs font-mono text-muted-foreground">{transaction._id}</div>

            {/* Mobile meta */}
            <div className="col-span-2 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground md:hidden">
              <span className="flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">
                  {transaction.type}
                </Badge>
                <span className="font-mono">${amount.toFixed(2)}</span>
              </span>
              <span className="capitalize">{transaction.status}</span>
              <span>{createdAtLabel}</span>
            </div>
          </div>

          {/* Actions (top-right on mobile) */}
          <div className="col-start-2 row-start-1 flex items-center justify-end gap-1 sm:gap-2 md:col-start-6 md:row-start-1">
            {requiresAction ? (
              <Badge
                variant="outline"
                className="hidden rounded-full px-3 py-1 text-xs uppercase tracking-wide md:inline-flex"
              >
                Action needed
              </Badge>
            ) : null}

            <div className="flex flex-nowrap items-center justify-end gap-1 sm:gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => openDetails(transaction)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all hover:-translate-y-[1px] hover:bg-secondary/80 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Review"
              >
                <Eye className="h-4 w-4" />
                <span className="hidden xs:inline">Review</span>
              </Button>

              
            </div>
          </div>

          {/* Desktop columns */}
          <div className="hidden md:flex md:col-start-2 md:row-start-1 md:items-start md:gap-2 md:pl-2">
            <Badge variant="secondary" className="capitalize">
              {transaction.type}
            </Badge>
          </div>
          <div className="hidden font-mono md:flex md:col-start-3 md:row-start-1 md:items-start">
            ${amount.toFixed(2)}
          </div>
          <div className="hidden md:flex md:col-start-4 md:row-start-1 md:items-center">
            <span
              className={
                transaction.status === "approved"
                  ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700"
                  : transaction.status === "pending"
                    ? "rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700"
                    : "rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700"
              }
            >
              {transaction.status}
            </span>
          </div>
          <div className="hidden text-xs text-muted-foreground md:flex md:col-start-5 md:row-start-1 md:items-start">
            {createdAtLabel}
          </div>
        </>
      )
    },
    [openDetails],
  )

  const renderRow = useCallback(
    ({ index, style }: { index: number; style: CSSProperties }) => {
      const transaction = items[index]
      if (!transaction) return null
      return (
        <div
          key={transaction._id}
          style={style}
        className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b px-3 py-4 text-sm transition-colors sm:px-5 sm:py-5 md:grid-cols-[minmax(220px,2fr)_repeat(4,minmax(120px,1fr))_auto] md:items-start md:gap-5"
        >
          {RowInner(transaction)}
        </div>
      )
    },
    [RowInner, items],
  )

  return (
    <Card className="space-y-3 py-5">
      <CardHeader className="flex flex-col gap-3 px-5 pb-3 md:flex-row md:items-center md:justify-between">
        <CardTitle className="text-2xl font-semibold">Transactions</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={onRefresh} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
          </Button>
          <Button onClick={onExport} variant="default" className="gap-2">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-5 pb-5">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        

        {/* Filters */}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
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

        {/* Table */}
        <div className="overflow-hidden rounded-md border">
          <div className="flex items-center justify-between bg-muted px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:hidden">
            <span>User</span>
            <span>Actions</span>
          </div>
          <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] items-center gap-4 bg-muted px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
            <span className="col-span-2">User</span>
            <span>Type</span>
            <span>Amount</span>
            <span>Status</span>
            <span>Date</span>
            <span className="text-right">Actions</span>
          </div>
          {!isMobile ? (
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
                <div className="py-5 text-center text-sm text-muted-foreground">No transactions found.</div>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {items.map((t) => (
                <div
                  key={t._id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-3 py-3 sm:px-5
                             text-sm rounded-lg bg-background/70 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]
                             ring-1 ring-border/60 hover:bg-muted/40 transition-colors"
                >
                  {RowInner(t)}
                </div>
              ))}
              {loading && (
                <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading
                </div>
              )}
              {!loading && items.length === 0 && (
                <div className="py-5 text-center text-sm text-muted-foreground">No transactions found.</div>
              )}
              {hasMore && !loading && (
                <div className="px-4 py-3">
                  <Button onClick={onLoadMore} variant="secondary" className="w-full">
                    Load more
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>

      {/* WIDE, NO-SCROLL MODAL */}
      <Dialog open={detailOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          className="flex w-[min(95vw,900px)] max-w-none gap-0 overflow-hidden rounded-2xl border border-border/60 bg-background/95 p-0 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-background/85 md:w-[min(60vw,900px)]"
        >
          <div className="flex max-h-[90vh] w-full flex-col">
            <DialogHeader className="border-b border-border/60 px-6 pb-4 pt-6 text-left sm:px-8 sm:pb-5">
              <DialogTitle className="text-xl font-semibold leading-tight text-foreground">
                Transaction details
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Review the request and take action.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
              {selectedTransaction ? (
                <div className="space-y-6 text-sm">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {/* USER */}
                    <section className="rounded-xl border border-border/60 bg-background/70 p-4 shadow-sm">
                      <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        User
                      </h4>
                      <div className="space-y-3 text-sm">
                        <div>
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">Name</span>
                          <div className="font-medium text-foreground">
                            {selectedTransaction.userId?.name || "Unknown"}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">Email</span>
                          <div className="break-words text-foreground/80">
                            {selectedTransaction.userId?.email || "—"}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">User ID</span>
                          <div className="font-mono text-xs text-foreground/90">
                            {selectedTransaction.userId?._id || "—"}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">Referral code</span>
                          <div className="text-foreground/80">
                            {selectedTransaction.userId?.referralCode || "—"}
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* TRANSACTION */}
                    <section className="rounded-xl border border-border/60 bg-background/70 p-4 shadow-sm">
                      <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Transaction
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">Type</span>
                          <div className="capitalize text-foreground">
                            {selectedTransaction.type}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">Status</span>
                          <div className="pt-1">
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
                        </div>
                        <div>
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">Amount</span>
                          <div className="font-mono text-base font-semibold text-foreground">
                            ${selectedAmount.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">Created at</span>
                          <div className="text-foreground/80">{selectedCreatedAtLabel}</div>
                        </div>
                        {selectedTransaction.meta?.transactionHash ? (
                          <div>
                            <span className="text-xs uppercase tracking-wide text-muted-foreground">Transaction hash</span>
                            <div className="break-words font-mono text-xs text-foreground/90">
                              {String(selectedTransaction.meta.transactionHash)}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </section>

                    {/* ADDITIONAL (meta) */}
                    <section className="rounded-xl border border-border/60 bg-background/70 p-4 shadow-sm sm:col-span-2 xl:col-span-1">
                      <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Additional details
                      </h4>
                      <div className="space-y-2">
                        {selectedTransaction.meta ? (
                          Object.entries(selectedTransaction.meta).map(([key, value]) => (
                            <div
                              key={key}
                              className="rounded-lg border border-border/40 bg-background/80 p-3 text-xs shadow-sm"
                            >
                              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {key}
                              </div>
                              <div className="break-words whitespace-pre-wrap text-foreground/85">
                                {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-muted-foreground">No additional metadata</div>
                        )}
                      </div>
                    </section>
                  </div>

                  {/* ACTION INPUTS */}
                  {selectedIsActionable ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {requiresTxHash ? (
                        <div className="space-y-2">
                          <Label htmlFor="admin-transaction-hash">Transaction hash</Label>
                          <Input
                            id="admin-transaction-hash"
                            value={txHash}
                            onChange={(event) => setTxHash(event.target.value)}
                          />
                        </div>
                      ) : null}
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="admin-transaction-reason">Rejection reason</Label>
                        <Textarea
                          id="admin-transaction-reason"
                          value={rejectionReason}
                          onChange={(event) => setRejectionReason(event.target.value)}
                          placeholder="Optional explanation for the user"
                          className="min-h-[120px]"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a transaction to view its details.
                </p>
              )}

              {actionError ? (
                <Alert variant="destructive" className="mt-6">
                  <AlertDescription>{actionError}</AlertDescription>
                </Alert>
              ) : null}
            </div>

            <DialogFooter className="gap-3 border-t border-border/60 bg-muted/40 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-8">
              <Button
                variant="ghost"
                onClick={() => handleDialogOpenChange(false)}
                disabled={actionLoading}
                className="w-full sm:w-auto"
              >
                Close
              </Button>
              {selectedIsActionable ? (
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleReject}
                    disabled={actionLoading}
                    className="gap-1 sm:min-w-[140px]"
                  >
                    {pendingAction === "reject" && actionLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                    Reject
                  </Button>
                  <Button
                    type="button"
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="gap-1 sm:min-w-[160px]"
                  >
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
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
