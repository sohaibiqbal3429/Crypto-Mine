"use client"

import { useState } from "react"
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
}

interface UserTableProps {
  users: User[]
  onRefresh: () => void
}

export function UserTable({ users, onRefresh }: UserTableProps) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showAdjustDialog, setShowAdjustDialog] = useState(false)
  const [adjustForm, setAdjustForm] = useState({
    amount: "",
    reason: "",
    type: "add",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

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
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
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
                ))}
              </TableBody>
            </Table>
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
