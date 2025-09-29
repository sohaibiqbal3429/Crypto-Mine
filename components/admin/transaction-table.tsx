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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Check, X, Eye } from "lucide-react"

interface Transaction {
  _id: string
  userId: {
    _id: string
    name: string
    email: string
    referralCode: string
  }
  type: string
  amount: number
  status: string
  meta: any
  createdAt: string
}

interface TransactionTableProps {
  transactions: Transaction[]
  onRefresh: () => void
}

export function TransactionTable({ transactions, onRefresh }: TransactionTableProps) {
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleApprove = async (transaction: Transaction) => {
    setLoading(true)
    setError("")

    try {
      const endpoint = transaction.type === "deposit" ? "/api/admin/approve-deposit" : "/api/admin/approve-withdraw"
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: transaction._id }),
      })

      if (response.ok) {
        onRefresh()
      } else {
        const data = await response.json()
        setError(data.error || "Failed to approve transaction")
      }
    } catch (err) {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    if (!selectedTransaction) return

    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/admin/reject-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: selectedTransaction._id,
          reason: rejectReason,
        }),
      })

      if (response.ok) {
        setShowRejectDialog(false)
        setRejectReason("")
        setSelectedTransaction(null)
        onRefresh()
      } else {
        const data = await response.json()
        setError(data.error || "Failed to reject transaction")
      }
    } catch (err) {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>
      case "approved":
        return (
          <Badge variant="default" className="bg-green-600">
            Approved
          </Badge>
        )
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getTypeBadge = (type: string) => {
    const colors = {
      deposit: "bg-blue-600",
      withdraw: "bg-orange-600",
      earn: "bg-green-600",
      commission: "bg-purple-600",
      bonus: "bg-amber-600",
      adjust: "bg-gray-600",
    }
    return <Badge className={colors[type as keyof typeof colors] || "bg-gray-600"}>{type}</Badge>
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Transaction Management</CardTitle>
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
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction._id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{transaction.userId.name}</div>
                        <div className="text-sm text-muted-foreground">{transaction.userId.email}</div>
                        <div className="text-xs font-mono">{transaction.userId.referralCode}</div>
                      </div>
                    </TableCell>
                    <TableCell>{getTypeBadge(transaction.type)}</TableCell>
                    <TableCell className="font-mono">${transaction.amount.toFixed(2)}</TableCell>
                    <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                    <TableCell>{new Date(transaction.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedTransaction(transaction)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {transaction.status === "pending" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleApprove(transaction)}
                              disabled={loading}
                              className="text-green-600 hover:text-green-700"
                            >
                              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedTransaction(transaction)
                                setShowRejectDialog(true)
                              }}
                              disabled={loading}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Details Dialog */}
      <Dialog open={!!selectedTransaction && !showRejectDialog} onOpenChange={() => setSelectedTransaction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>User</Label>
                  <p className="text-sm">{selectedTransaction.userId.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedTransaction.userId.email}</p>
                </div>
                <div>
                  <Label>Type</Label>
                  <p className="text-sm">{selectedTransaction.type}</p>
                </div>
                <div>
                  <Label>Amount</Label>
                  <p className="text-sm font-mono">${selectedTransaction.amount.toFixed(2)}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <p className="text-sm">{selectedTransaction.status}</p>
                </div>
              </div>
              {selectedTransaction.meta && (
                <div>
                  <Label>Additional Info</Label>
                  <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                    {JSON.stringify(selectedTransaction.meta, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Transaction</DialogTitle>
            <DialogDescription>Please provide a reason for rejecting this transaction.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                placeholder="Enter rejection reason..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={loading || !rejectReason}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Reject Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
