"use client"

import { type CSSProperties, useCallback, useEffect, useMemo } from "react"
import debounce from "lodash.debounce"
import { FixedSizeList as List, type ListOnItemsRenderedProps } from "react-window"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, RefreshCw, Download } from "lucide-react"
import type { AdminTransactionRecord } from "@/lib/types/admin"

const ROW_HEIGHT = 96
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

  const renderRow = useCallback(
    ({ index, style }: { index: number; style: CSSProperties }) => {
      const transaction = items[index]
      if (!transaction) {
        return null
      }

      return (
        <div
          key={transaction._id}
          style={style}
          className="grid grid-cols-1 gap-2 border-b px-4 py-3 text-sm md:grid-cols-[2fr_1fr_1fr_1fr_1fr] md:items-center md:gap-4"
        >
          <div className="space-y-1 md:col-span-2">
            <div className="font-medium">{transaction.userId?.name || "Unknown"}</div>
            <div className="text-xs text-muted-foreground">{transaction.userId?.email}</div>
            <div className="text-xs font-mono text-muted-foreground">{transaction._id}</div>
          </div>
          <div>
            <Badge variant="secondary" className="capitalize">
              {transaction.type}
            </Badge>
          </div>
          <div className="font-mono">${transaction.amount.toFixed(2)}</div>
          <div>
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
          <div className="text-xs text-muted-foreground">
            {new Date(transaction.createdAt).toLocaleString()}
          </div>
        </div>
      )
    },
    [items],
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
          <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_1fr] items-center gap-4 bg-muted px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
            <span className="col-span-2">User</span>
            <span>Type</span>
            <span>Amount</span>
            <span>Status</span>
            <span>Date</span>
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
    </Card>
  )
}
