"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Settings } from "lucide-react"

interface User {
  _id: string
  name: string
  email: string
  referralCode: string
  role: string
  level: number
  directActiveCount: number
  totalActiveDirects: number
  lastLevelUpAt: string | null
  depositTotal: number
  withdrawTotal: number
  roiEarnedTotal: number
  isActive: boolean
  createdAt: string
  balance: {
    current: number
    totalBalance: number
    totalEarning: number
    lockedCapital: number
    staked: number
    pendingWithdraw: number
  }
  levelHistory?: { level: number; achievedAt: string }[]
}

interface PaginationMeta {
  page: number
  pages: number
  limit: number
  total: number
}

interface UserTableProps {
  users: User[]
  pagination: PaginationMeta
  onPageChange: (page: number) => void
  onRefresh: () => void
}

export function UserTable({ users, pagination, onPageChange, onRefresh }: UserTableProps) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showAdjustDialog, setShowAdjustDialog] = useState(false)
  const [adjustForm, setAdjustForm] = useState({
    amount: "",
    reason: "",
    type: "add",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const paginationStart = useMemo(() => {
    if (pagination.total === 0) return 0
    return (pagination.page - 1) * pagination.limit + 1
  }, [pagination.limit, pagination.page, pagination.total])

  const paginationEnd = useMemo(() => {
    if (pagination.total === 0) return 0
    return Math.min(pagination.page * pagination.limit, pagination.total)
  }, [pagination.limit, pagination.page, pagination.total])
  const hasNextPage = pagination.page < pagination.pages || users.length === pagination.limit

  const goToPreviousPage = () => {
    if (pagination.page > 1) {
      onPageChange(pagination.page - 1)
    }
  }

  const goToNextPage = () => {
    if (hasNextPage) {
      onPageChange(pagination.page + 1)
    }
  }

  const handleAdjustBalance = async () => {
    if (!selectedUser) return

    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/admin/adjust-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser._id,
          amount: adjustForm.amount,
          reason: adjustForm.reason,
          type: adjustForm.type,
        }),
      })

      if (response.ok) {
        setShowAdjustDialog(false)
        setAdjustForm({ amount: "", reason: "", type: "add" })
        setSelectedUser(null)
        onRefresh()
      } else {
        const data = await response.json()
        setError(data.error || "Failed to adjust balance")
      }
    } catch (err) {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Deposits</TableHead>
                  <TableHead>Current Balance</TableHead>
                  <TableHead>Total Earnings</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                      No users found for the current search.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user._id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                          <div className="text-xs font-mono">{user.referralCode}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.level > 0 ? "default" : "secondary"}>Level {user.level}</Badge>
                      </TableCell>
                      <TableCell className="font-mono">${user.depositTotal.toFixed(2)}</TableCell>
                      <TableCell className="font-mono">${user.balance.current.toFixed(2)}</TableCell>
                      <TableCell className="font-mono text-green-600">${user.balance.totalEarning.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div className="flex items-center justify-between">
                            <span>Direct cycle</span>
                            <span className="font-semibold text-foreground">{user.directActiveCount}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Total qualified</span>
                            <span className="font-semibold text-foreground">{user.totalActiveDirects}</span>
                          </div>
                          <div>
                            <span className="block">Last level up:</span>
                            <span className="font-semibold text-foreground">
                              {user.lastLevelUpAt ? new Date(user.lastLevelUpAt).toLocaleString() : "—"}
                            </span>
                          </div>
                          <div>
                            <span className="block">Level history:</span>
                            <span className="font-semibold text-foreground">
                              {user.levelHistory && user.levelHistory.length > 0
                                ? user.levelHistory
                                    .map(
                                      (entry) =>
                                        `L${entry.level}: ${new Date(entry.achievedAt).toLocaleDateString()}`,
                                    )
                                    .join(" • ")
                                : "No records"}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? "default" : "secondary"}>
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user)
                            setShowAdjustDialog(true)
                          }}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {pagination.total > 0
                ? `Showing ${paginationStart.toLocaleString()}-${paginationEnd.toLocaleString()} of ${pagination.total.toLocaleString()} users`
                : "No users to display"}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToPreviousPage} disabled={pagination.page <= 1}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {Math.min(pagination.page, pagination.pages).toLocaleString()} of {Math.max(pagination.pages, 1).toLocaleString()}
              </span>
              <Button variant="outline" size="sm" onClick={goToNextPage} disabled={!hasNextPage}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Adjust Balance Dialog */}
      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust User Balance</DialogTitle>
            <DialogDescription>
              {selectedUser && `Adjusting balance for ${selectedUser.name} (${selectedUser.email})`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedUser && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm">
                  <strong>Current Balance:</strong> ${selectedUser.balance.current.toFixed(2)}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="type">Type</Label>
                <Select
                  value={adjustForm.type}
                  onValueChange={(value) => setAdjustForm((prev) => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">Add to Balance</SelectItem>
                    <SelectItem value="subtract">Subtract from Balance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Enter amount"
                  value={adjustForm.amount}
                  onChange={(e) => setAdjustForm((prev) => ({ ...prev, amount: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                placeholder="Enter reason for adjustment..."
                value={adjustForm.reason}
                onChange={(e) => setAdjustForm((prev) => ({ ...prev, reason: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjustDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdjustBalance} disabled={loading || !adjustForm.amount || !adjustForm.reason}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Adjust Balance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
