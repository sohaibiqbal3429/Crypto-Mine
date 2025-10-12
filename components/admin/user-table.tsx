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
import { ensureNumber } from "@/lib/utils/safe-parsing"

const DESKTOP_ROW_HEIGHT = 128
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
  const isMobile = useIsMobile()

  const [selectedUser, setSelectedUser] = useState<AdminUserRecord | null>(null)
  const [showAdjustDialog, setShowAdjustDialog] = useState(false)
  const [adjustForm, setAdjustForm] = useState({ type: "add", amount: "", reason: "" })
  const [adjustLoading, setAdjustLoading] = useState(false)
  const [adjustError, setAdjustError] = useState<string | null>(null)

  const selectedDepositTotal = ensureNumber(selectedUser?.depositTotal, 0)
  const selectedWithdrawTotal = ensureNumber(selectedUser?.withdrawTotal, 0)
  const selectedBalanceCurrent = ensureNumber(selectedUser?.balance?.current, 0)
  const selectedBalanceEarning = ensureNumber(selectedUser?.balance?.totalEarning, 0)
  const selectedLevel = ensureNumber(selectedUser?.level, 0)
  const selectedDirectActive = ensureNumber(selectedUser?.directActiveCount, 0)

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
      if (hasMore && !loading && visibleStopIndex >= items.length - 5) onLoadMore()
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

  // ---- Row (desktop + mobile) ----
  const RowInner = useCallback(
    (user: AdminUserRecord) => {
      const level = ensureNumber(user.level, 0)
      const directActiveCount = ensureNumber(user.directActiveCount, 0)
      const depositTotal = ensureNumber(user.depositTotal, 0)
      const withdrawTotal = ensureNumber(user.withdrawTotal, 0)
      const balanceCurrent = ensureNumber(user.balance?.current, 0)
      const balanceEarnings = ensureNumber(user.balance?.totalEarning, 0)

      const nextRequirement = getNextLevelRequirement(level)
      const progressLabel = nextRequirement !== null ? `${directActiveCount} / ${nextRequirement}` : `${directActiveCount} / —`

      return (
        <>
          {/* Left: user */}
          <div className="space-y-1 md:col-span-2">
            <div className="font-medium leading-tight">{user.name || "Unknown"}</div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
            <div className="text-xs font-mono text-muted-foreground">{user.referralCode}</div>

            {/* Mobile summary */}
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground md:hidden">
              <span className="flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">Lvl {level}</Badge>
                <span>Prog: {progressLabel}</span>
              </span>
              <span className="font-mono">${depositTotal.toFixed(2)}</span>
              <span>Bal ${balanceCurrent.toFixed(2)}</span>
              <span className="opacity-80">Earn ${balanceEarnings.toFixed(2)}</span>
            </div>
          </div>

          {/* Right: actions top-right on mobile */}
          <div className="col-start-2 row-start-1 flex items-center justify-end gap-2 md:col-start-5">
            <Badge
              variant={user.status === "active" ? "default" : "secondary"}
              className="capitalize"
              title={`Status: ${user.status ?? "inactive"}`}
            >
              {user.status ?? "inactive"}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openAdjustDialog(user)}
              className="gap-1 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Adjust balance"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden xs:inline">Adjust</span>
            </Button>
          </div>

          {/* Desktop columns */}
          <div className="hidden text-xs text-muted-foreground md:block">
            <div>Level {level}</div>
            <div>Progress: {progressLabel}</div>
          </div>
          <div className="hidden text-sm font-mono md:block">
            <div>${depositTotal.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Withdraw ${withdrawTotal.toFixed(2)}</div>
          </div>
          <div className="hidden text-sm font-mono md:block">
            <div>Balance ${balanceCurrent.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Earnings ${balanceEarnings.toFixed(2)}</div>
          </div>
        </>
      )
    },
    [openAdjustDialog],
  )

  const renderRow = useCallback(
    ({ index, style }: { index: number; style: CSSProperties }) => {
      const user = items[index]
      if (!user) return null
      return (
        <div
          key={user._id}
          style={style}
          className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b px-4 py-3 text-sm sm:px-6 md:grid-cols-[2fr_1fr_1fr_1fr_1fr] md:items-center md:gap-4"
        >
          {RowInner(user)}
        </div>
      )
    },
    [RowInner, items],
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

        {/* Filters */}
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
              itemSize={DESKTOP_ROW_HEIGHT}
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

      {/* WIDE, NO-SCROLL MODAL */}
      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent className="w-[min(1200px,95vw)] max-w-none overflow-visible p-6">
          <DialogHeader className="pb-2">
            <DialogTitle>Adjust balance</DialogTitle>
            <DialogDescription>
              Update the balance for {selectedUser?.name}. This action is recorded in the audit log.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-3">
            {/* USER SNAPSHOT */}
            <div className="rounded-md border p-3">
              <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">User</h4>
              <div className="space-y-1 text-sm">
                <div><span className="text-xs uppercase text-muted-foreground">Name</span><div className="font-medium">{selectedUser?.name || "Unknown"}</div></div>
                <div><span className="text-xs uppercase text-muted-foreground">Email</span><div className="break-all text-muted-foreground">{selectedUser?.email || "—"}</div></div>
                <div><span className="text-xs uppercase text-muted-foreground">User ID</span><div className="font-mono text-xs">{selectedUser?._id || "—"}</div></div>
                <div><span className="text-xs uppercase text-muted-foreground">Referral</span><div className="text-muted-foreground">{selectedUser?.referralCode || "—"}</div></div>
              </div>
            </div>

            {/* BALANCES */}
            <div className="rounded-md border p-3">
              <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Balances</h4>
              <div className="space-y-1 text-sm font-mono">
                <div>Deposit ${selectedDepositTotal.toFixed(2)}</div>
                <div>Withdraw ${selectedWithdrawTotal.toFixed(2)}</div>
                <div>Balance ${selectedBalanceCurrent.toFixed(2)}</div>
                <div>Earnings ${selectedBalanceEarning.toFixed(2)}</div>
              </div>
            </div>

            {/* LEVEL */}
            <div className="rounded-md border p-3">
              <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Level</h4>
              <div className="space-y-1 text-sm">
                <div>Level {selectedLevel}</div>
                <div>Direct Active: {selectedDirectActive}</div>
                <Badge variant={selectedUser?.status === "active" ? "default" : "secondary"} className="capitalize">
                  {selectedUser?.status ?? "inactive"}
                </Badge>
              </div>
            </div>

            {/* FORM (spans all on desktop) */}
            <div className="md:col-span-3 grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={adjustForm.type}
                  onValueChange={(value) => setAdjustForm((prev) => ({ ...prev, type: value }))}
                >
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
                  onChange={(e) => setAdjustForm((prev) => ({ ...prev, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-1"></div>
              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="adjust-reason">Reason</Label>
                <Textarea
                  id="adjust-reason"
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm((prev) => ({ ...prev, reason: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {adjustError && (
            <Alert variant="destructive" className="mt-2">
              <AlertDescription>{adjustError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="mt-2">
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
