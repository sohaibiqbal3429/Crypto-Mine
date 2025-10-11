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

  // ---- Row (desktop + mobile) ----
  const RowInner = useCallback(
    (transaction: AdminTransactionRecord) => {
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
                <span className="font-mono">${transaction.amount.toFixed(2)}</span>
              </span>
              <span className="capitalize">{transaction.status}</span>
              <span>{new Date(transaction.createdAt).toLocaleString()}</span>
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
            ${transaction.amount.toFixed(2)}
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
            {new Date(transaction.createdAt).toLocaleString()}
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
          className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b px-4 py-5 text-sm transition-colors sm:px-6 sm:py-6 md:grid-cols-[minmax(220px,2fr)_repeat(4,minmax(120px,1fr))_auto] md:items-start md:gap-6"
        >
          {RowInner(transaction)}
        </div>
      )
    },
    [RowInner, items],
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
        

        {/* Filters */}
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

        {/* Table */}
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
                <div className="py-6 text-center text-sm text-muted-foreground">No transactions found.</div>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {items.map((t) => (
                <div
                  key={t._id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-3 py-4 sm:px-6
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
                <div className="py-6 text-center text-sm text-muted-foreground">No transactions found.</div>
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
          className="w-[min(1200px,95vw)] max-w-none overflow-visible p-6"
        >
          <DialogHeader className="pb-2">
            <DialogTitle>Transaction details</DialogTitle>
            <DialogDescription>Review the request and take action.</DialogDescription>
          </DialogHeader>

          {selectedTransaction ? (
            <div className="grid gap-4 text-sm md:grid-cols-3">
              {/* USER */}
              <div className="rounded-md border p-3">
                <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">User</h4>
                <div className="space-y-1">
                  <div><span className="text-xs uppercase text-muted-foreground">Name</span><div className="font-medium">{selectedTransaction.userId?.name || "Unknown"}</div></div>
                  <div><span className="text-xs uppercase text-muted-foreground">Email</span><div className="break-all text-muted-foreground">{selectedTransaction.userId?.email || "—"}</div></div>
                  <div><span className="text-xs uppercase text-muted-foreground">User ID</span><div className="font-mono text-xs">{selectedTransaction.userId?._id || "—"}</div></div>
                  <div><span className="text-xs uppercase text-muted-foreground">Referral code</span><div className="text-muted-foreground">{selectedTransaction.userId?.referralCode || "—"}</div></div>
                </div>
              </div>

              {/* TRANSACTION */}
              <div className="rounded-md border p-3">
                <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Transaction</h4>
                <div className="space-y-1">
                  <div><span className="text-xs uppercase text-muted-foreground">Type</span><div className="capitalize">{selectedTransaction.type}</div></div>
                  <div>
                    <span className="text-xs uppercase text-muted-foreground">Status</span>
                    <div>
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
                  <div><span className="text-xs uppercase text-muted-foreground">Amount</span><div className="font-mono text-base font-semibold">${selectedTransaction.amount.toFixed(2)}</div></div>
                  <div><span className="text-xs uppercase text-muted-foreground">Created at</span><div>{new Date(selectedTransaction.createdAt).toLocaleString()}</div></div>
                  {selectedTransaction.meta?.transactionHash ? (
                    <div>
                      <span className="text-xs uppercase text-muted-foreground">Transaction hash</span>
                      <div className="break-all font-mono text-xs">{String(selectedTransaction.meta.transactionHash)}</div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* ADDITIONAL (meta) */}
              <div className="rounded-md border p-3">
                <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Additional</h4>
                <div className="space-y-2">
                  {selectedTransaction.meta
                    ? Object.entries(selectedTransaction.meta).map(([k, v]) => (
                        <div key={k} className="rounded bg-muted/40 p-2 text-xs">
                          <div className="mb-1 font-medium uppercase text-muted-foreground">{k}</div>
                          <div className="break-words">{typeof v === "object" ? JSON.stringify(v) : String(v)}</div>
                        </div>
                      ))
                    : <div className="text-muted-foreground">—</div>}
                </div>
              </div>

              {/* ACTION INPUTS */}
              {selectedIsActionable ? (
                <div className="md:col-span-3 grid gap-3 md:grid-cols-3">
                  {requiresTxHash ? (
                    <div className="space-y-1">
                      <Label htmlFor="admin-transaction-hash">Transaction hash</Label>
                      <Input id="admin-transaction-hash" value={txHash} onChange={(e) => setTxHash(e.target.value)} />
                    </div>
                  ) : null}
                  <div className="md:col-span-2 space-y-1">
                    <Label htmlFor="admin-transaction-reason">Rejection reason</Label>
                    <Textarea id="admin-transaction-reason" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Optional explanation for the user" />
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a transaction to view its details.</p>
          )}

          {actionError ? (
            <Alert variant="destructive" className="mt-2">
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" onClick={() => handleDialogOpenChange(false)} disabled={actionLoading}>
              Close
            </Button>
            {selectedIsActionable ? (
              <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={handleReject} disabled={actionLoading} className="gap-1">
                  {pendingAction === "reject" && actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                  Reject
                </Button>
                <Button type="button" onClick={handleApprove} disabled={actionLoading} className="gap-1">
                  {pendingAction === "approve" && actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
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
