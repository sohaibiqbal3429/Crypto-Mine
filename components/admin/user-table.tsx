"use client"

import { type CSSProperties, useCallback, useEffect, useMemo, useState } from "react"
import debounce from "lodash.debounce"
import { FixedSizeList as List, type ListOnItemsRenderedProps } from "react-window"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, RefreshCw, Settings } from "lucide-react"
import type { AdminUserRecord } from "@/lib/types/admin"
import { getNextLevelRequirement } from "@/lib/utils/leveling"

const DESKTOP_ROW_HEIGHT = 128
const MOBILE_ROW_HEIGHT = 200
const MOBILE_BREAKPOINT = 768
const VIRTUAL_LIST_HEIGHT = 540

export interface UserFilters {
  status?: string
  q?: string
  from?: string
  to?: string
}

interface UserTableProps {
  items: AdminUserRecord[]
  loading: boolean
  error?: string | null
  hasMore: boolean
  onLoadMore: () => void
  onRefresh: () => void
  filters: UserFilters
  onFiltersChange: (filters: UserFilters) => void
}

export function UserTable({
  items,
  loading,
  error,
  hasMore,
  onLoadMore,
  onRefresh,
  filters,
  onFiltersChange,
}: UserTableProps) {
  const [selectedUser, setSelectedUser] = useState<AdminUserRecord | null>(null)
  const [showAdjustDialog, setShowAdjustDialog] = useState(false)
  const [adjustForm, setAdjustForm] = useState({ type: "add", amount: "", reason: "" })
  const [adjustLoading, setAdjustLoading] = useState(false)
  const [adjustError, setAdjustError] = useState<string | null>(null)

  const [rowHeight, setRowHeight] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT
      ? MOBILE_ROW_HEIGHT
      : DESKTOP_ROW_HEIGHT,
  )

  useEffect(() => {
    if (typeof window === "undefined") return

    const updateRowHeight = () => {
      setRowHeight(window.innerWidth < MOBILE_BREAKPOINT ? MOBILE_ROW_HEIGHT : DESKTOP_ROW_HEIGHT)
    }

    updateRowHeight()
    window.addEventListener("resize", updateRowHeight)

    return () => window.removeEventListener("resize", updateRowHeight)
  }, [])

  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        onFiltersChange({ ...filters, q: value || undefined })
      }, 300),
    [filters, onFiltersChange],
  )

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch])

  const handleItemsRendered = useCallback(
    ({ visibleStopIndex }: ListOnItemsRenderedProps) => {
      if (hasMore && !loading && visibleStopIndex >= items.length - 5) {
        onLoadMore()
      }
    },
    [hasMore, loading, items.length, onLoadMore],
  )

  const openAdjustDialog = useCallback((user: AdminUserRecord) => {
    setSelectedUser(user)
    setAdjustForm({ type: "add", amount: "", reason: "" })
    setAdjustError(null)
    setShowAdjustDialog(true)
  }, [])

  const submitAdjustBalance = useCallback(async () => {
    if (!selectedUser) return
    const payload = {
      userId: selectedUser._id,
      amount: Number(adjustForm.amount || 0),
      reason: adjustForm.reason.trim(),
      type: adjustForm.type,
    }

    if (!payload.amount || !payload.reason) {
      setAdjustError("Amount and reason are required")
      return
    }

    setAdjustLoading(true)
    try {
      const response = await fetch("/api/admin/adjust-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Failed to adjust balance")
      }

      setShowAdjustDialog(false)
      onRefresh()
    } catch (exception) {
      setAdjustError(exception instanceof Error ? exception.message : "Unable to adjust balance")
    } finally {
      setAdjustLoading(false)
    }
  }, [adjustForm.amount, adjustForm.reason, adjustForm.type, onRefresh, selectedUser])

  const renderRow = useCallback(
    ({ index, style }: { index: number; style: CSSProperties }) => {
      const user = items[index]
      if (!user) return null

      const nextRequirement = getNextLevelRequirement(user.level)
      const progressLabel =
        nextRequirement !== null ? `${user.directActiveCount} / ${nextRequirement}` : `${user.directActiveCount} / —`

      return (
        <div
          key={user._id}
          style={style}
          className="grid grid-cols-1 gap-3 border-b px-4 py-3 text-sm md:grid-cols-[2fr_1fr_1fr_1fr_1fr] md:items-center md:gap-4"
        >
          <div className="space-y-1 md:col-span-2">
            <div className="font-medium">{user.name}</div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
            <div className="text-xs font-mono text-muted-foreground">{user.referralCode}</div>
          </div>
          <div className="text-xs text-muted-foreground">
            <div>Level {user.level}</div>
            <div>Progress: {progressLabel}</div>
          </div>
          <div className="text-sm font-mono">
            <div>${user.depositTotal.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Withdraw ${user.withdrawTotal.toFixed(2)}</div>
          </div>
          <div className="text-sm font-mono">
            <div>Balance ${user.balance.current.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Earnings ${user.balance.totalEarning.toFixed(2)}</div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Badge variant={user.status === "active" ? "default" : "secondary"} className="capitalize">
              {user.status ?? "inactive"}
            </Badge>
            <Button size="sm" variant="ghost" onClick={() => openAdjustDialog(user)} className="gap-1">
              <Settings className="h-4 w-4" /> Adjust
            </Button>
          </div>
        </div>
      )
    },
    [items, openAdjustDialog],
  )

  return (
    <Card className="space-y-4">
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <CardTitle className="text-2xl font-semibold">Users</CardTitle>
        <Button variant="secondary" onClick={onRefresh} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="user-search">Search users</Label>
            <Input
              id="user-search"
              placeholder="Email, name or referral code"
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
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-from">From</Label>
            <Input
              id="user-from"
              type="date"
              value={filters.from ?? ""}
              onChange={(event) => onFiltersChange({ ...filters, from: event.target.value || undefined })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-to">To</Label>
            <Input
              id="user-to"
              type="date"
              value={filters.to ?? ""}
              onChange={(event) => onFiltersChange({ ...filters, to: event.target.value || undefined })}
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-md border">
          <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_1fr] items-center gap-4 bg-muted px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
            <span className="col-span-2">User</span>
            <span>Level</span>
            <span>Deposits</span>
            <span>Balances</span>
            <span>Status</span>
          </div>
          <div style={{ height: VIRTUAL_LIST_HEIGHT }}>
            <List
              height={VIRTUAL_LIST_HEIGHT}
              itemCount={items.length}
              itemSize={rowHeight}
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
              <div className="py-6 text-center text-sm text-muted-foreground">No users found.</div>
            )}
          </div>
        </div>
      </CardContent>

      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust balance</DialogTitle>
            <DialogDescription>
              Update the balance for {selectedUser?.name}. This action is recorded in the audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={adjustForm.type} onValueChange={(value) => setAdjustForm((prev) => ({ ...prev, type: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add funds</SelectItem>
                  <SelectItem value="subtract">Remove funds</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjust-amount">Amount</Label>
              <Input
                id="adjust-amount"
                type="number"
                value={adjustForm.amount}
                onChange={(event) => setAdjustForm((prev) => ({ ...prev, amount: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjust-reason">Reason</Label>
              <Textarea
                id="adjust-reason"
                value={adjustForm.reason}
                onChange={(event) => setAdjustForm((prev) => ({ ...prev, reason: event.target.value }))}
              />
            </div>
            {adjustError && (
              <Alert variant="destructive">
                <AlertDescription>{adjustError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAdjustDialog(false)} disabled={adjustLoading}>
              Cancel
            </Button>
            <Button onClick={submitAdjustBalance} disabled={adjustLoading} className="gap-2">
              {adjustLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
