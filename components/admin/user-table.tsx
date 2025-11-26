"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import debounce from "lodash.debounce"
import { format } from "date-fns"
import { Loader2, RefreshCw } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import type { AdminUserRecord } from "@/lib/types/admin"

export interface UserFilters {
  status?: "active" | "inactive" | "blocked"
  q?: string
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

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
})

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  try {
    return format(new Date(value), "MMM d, yyyy HH:mm")
  } catch (error) {
    console.warn("Invalid date", value, error)
    return "—"
  }
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
  const [showSettings, setShowSettings] = useState(false)
  const [adjustForm, setAdjustForm] = useState({ direction: "credit", amount: "", reason: "" })
  const [adjustLoading, setAdjustLoading] = useState(false)
  const [adjustError, setAdjustError] = useState<string | null>(null)
  const [blockLoading, setBlockLoading] = useState(false)
  const [blockError, setBlockError] = useState<string | null>(null)
  const [searchValue, setSearchValue] = useState(filters.q ?? "")
  // Per-user daily mining rate override state
  const [rateDraft, setRateDraft] = useState<string>("")
  const [rateCurrent, setRateCurrent] = useState<number | null>(null)
  const [rateLoading, setRateLoading] = useState(false)
  const [rateError, setRateError] = useState<string | null>(null)

  useEffect(() => {
    setSearchValue(filters.q ?? "")
  }, [filters.q])

  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        onFiltersChange({ ...filters, q: value || undefined })
      }, 300),
    [filters, onFiltersChange],
  )

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch])

  const openSettings = useCallback(
    (user: AdminUserRecord) => {
      setSelectedUser(user)
      setAdjustForm({ direction: "credit", amount: "", reason: "" })
      setAdjustError(null)
      setBlockError(null)
      setShowSettings(true)
      // load rate override lazily
      setRateDraft("")
      setRateCurrent(null)
      setRateError(null)
      setRateLoading(true)
      fetch(`/api/admin/users/${user._id}/mining-rate`)
        .then((res) => res.json())
        .then((data) => {
          const o = typeof data?.override === "number" ? data.override : null
          setRateCurrent(o)
          setRateDraft(o !== null ? o.toFixed(2) : "")
        })
        .catch((err) => setRateError(err instanceof Error ? err.message : "Failed to load rate"))
        .finally(() => setRateLoading(false))
    },
    [],
  )

  const closeSettings = useCallback(() => {
    setShowSettings(false)
    setSelectedUser(null)
    setRateDraft("")
    setRateCurrent(null)
    setRateError(null)
  }, [])

  const submitAdjustBalance = useCallback(async () => {
    if (!selectedUser) return
    const amountValue = Number.parseFloat(adjustForm.amount)
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setAdjustError("Enter an amount greater than zero")
      return
    }
    if (!adjustForm.reason.trim()) {
      setAdjustError("Reason is required")
      return
    }

    setAdjustLoading(true)
    setAdjustError(null)

    try {
      const response = await fetch(`/api/admin/users/${selectedUser._id}/balance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountValue,
          direction: adjustForm.direction,
          reason: adjustForm.reason.trim(),
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || "Failed to update balance")
      }

      onRefresh()
      setShowSettings(false)
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : "Failed to update balance")
    } finally {
      setAdjustLoading(false)
    }
  }, [adjustForm.amount, adjustForm.direction, adjustForm.reason, onRefresh, selectedUser])

  const handleBlockToggle = useCallback(
    async (nextBlocked: boolean) => {
      if (!selectedUser) return
      setBlockLoading(true)
      setBlockError(null)
      try {
        const response = await fetch(`/api/admin/users/${selectedUser._id}/block`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blocked: nextBlocked }),
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload.error || "Failed to update block status")
        }

        setSelectedUser((current) => (current ? { ...current, isBlocked: nextBlocked } : current))
        onRefresh()
      } catch (err) {
        setBlockError(err instanceof Error ? err.message : "Failed to update block status")
      } finally {
        setBlockLoading(false)
      }
    },
    [onRefresh, selectedUser],
  )

  const handleStatusChange = useCallback(
    (value: string) => {
      const status = value === "all" ? undefined : (value as UserFilters["status"])
      onFiltersChange({ ...filters, status })
    },
    [filters, onFiltersChange],
  )

  return (
    <Card className="space-y-3 py-5">
      <CardHeader className="flex flex-col gap-3 px-5 pb-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-2xl font-semibold">Users</CardTitle>
          <p className="text-sm text-muted-foreground">Search, filter, and manage customer accounts.</p>
        </div>
        <Button variant="secondary" onClick={onRefresh} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 px-5 pb-5">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="user-search">Search users</Label>
            <Input
              id="user-search"
              placeholder="Email, name, or referral code"
              value={searchValue}
              onChange={(event) => {
                const value = event.target.value
                setSearchValue(value)
                debouncedSearch(value)
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={filters.status ?? "all"} onValueChange={handleStatusChange}>
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>KYC</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Manage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((user) => (
                <TableRow key={user._id} className="align-middle">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{user.name || "Unknown"}</span>
                      <span className="text-xs text-muted-foreground">{user.referralCode}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{user.email}</span>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {currencyFormatter.format(user.balance?.current ?? 0)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant={user.isActive ? "default" : "secondary"} className="w-fit capitalize">
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {user.isBlocked && (
                        <Badge variant="destructive" className="w-fit">Blocked</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {user.kycStatus ?? "unverified"}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(user.lastLoginAt)}</TableCell>
                  <TableCell>{formatDate(user.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openSettings(user)}
                      className="gap-1"
                    >
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {!loading && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    No users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading users
          </div>
        )}

        {hasMore && !loading && (
          <div className="flex justify-center">
            <Button onClick={onLoadMore} variant="ghost">
              Load more
            </Button>
          </div>
        )}
      </CardContent>

      <Dialog open={showSettings} onOpenChange={(open) => (!open ? closeSettings() : setShowSettings(open))}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>User Settings</DialogTitle>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">Account</h3>
                  <div className="mt-3 space-y-1 text-sm">
                    <div className="font-medium">{selectedUser.name || "Unknown"}</div>
                    <div className="break-all text-muted-foreground">{selectedUser.email}</div>
                    <div className="text-xs text-muted-foreground">ID: {selectedUser._id}</div>
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">Status</h3>
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Blocked</p>
                      <p className="text-xs text-muted-foreground">
                        Blocked users cannot access the dashboard, deposits, or withdrawals.
                      </p>
                    </div>
                    <Switch
                      checked={selectedUser.isBlocked}
                      onCheckedChange={(value) => handleBlockToggle(Boolean(value))}
                      disabled={blockLoading}
                      aria-label={selectedUser.isBlocked ? "Unblock user" : "Block user"}
                    />
                  </div>
                  {blockError && (
                    <Alert variant="destructive" className="mt-3">
                      <AlertDescription>{blockError}</AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">Daily mining rate</h3>
                <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
                  <div>
                    <Label htmlFor="mining-rate">User override (%)</Label>
                    <Input
                      id="mining-rate"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      placeholder="e.g. 1.50"
                      value={rateDraft}
                      onChange={(e) => setRateDraft(e.target.value)}
                      disabled={rateLoading}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Clear to remove override and use global default.
                    </p>
                    {rateError && <p className="text-xs text-destructive">{rateError}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={async () => {
                        if (!selectedUser) return
                        setRateLoading(true)
                        setRateError(null)
                        try {
                          const body = rateDraft.trim() === "" ? { percent: null } : { percent: Number.parseFloat(rateDraft) }
                          const res = await fetch(`/api/admin/users/${selectedUser._id}/mining-rate`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(body),
                          })
                          const data = await res.json()
                          if (!res.ok) {
                            throw new Error(data?.error || "Failed to save override")
                          }
                          const o = typeof data?.override === "number" ? data.override : null
                          setRateCurrent(o)
                          setRateDraft(o !== null ? o.toFixed(2) : "")
                        } catch (e: any) {
                          setRateError(e?.message || "Failed to save override")
                        } finally {
                          setRateLoading(false)
                        }
                      }}
                      disabled={rateLoading}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setRateDraft(rateCurrent !== null ? rateCurrent.toFixed(2) : "")}
                      disabled={rateLoading}
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">Adjust Balance</h3>
                <div className="mt-3 grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="adjust-direction">Action</Label>
                    <Select
                      value={adjustForm.direction}
                      onValueChange={(value) => setAdjustForm((prev) => ({ ...prev, direction: value }))}
                    >
                      <SelectTrigger id="adjust-direction">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="credit">Credit funds</SelectItem>
                        <SelectItem value="debit">Debit funds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adjust-amount">Amount</Label>
                    <Input
                      id="adjust-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={adjustForm.amount}
                      onChange={(event) => setAdjustForm((prev) => ({ ...prev, amount: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-3">
                    <Label htmlFor="adjust-reason">Reason</Label>
                    <Textarea
                      id="adjust-reason"
                      value={adjustForm.reason}
                      onChange={(event) => setAdjustForm((prev) => ({ ...prev, reason: event.target.value }))}
                      rows={3}
                    />
                  </div>
                </div>
                {adjustError && (
                  <Alert variant="destructive" className="mt-3">
                    <AlertDescription>{adjustError}</AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={closeSettings} disabled={adjustLoading || blockLoading}>
              Cancel
            </Button>
            <Button onClick={submitAdjustBalance} disabled={adjustLoading || blockLoading} className="gap-2">
              {adjustLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
