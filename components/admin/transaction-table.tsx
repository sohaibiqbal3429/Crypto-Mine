"use client"

import { useEffect, useMemo, useState } from "react"
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
  userId:
    | {
        _id: string
        name?: string
        email?: string
        referralCode?: string
        toString?: () => string
      }
    | string
    | null
    | undefined
  type: string
  amount: number
  status: string
  meta: any
  createdAt: string
}

type ReceiptMeta = {
  url?: string
  originalName?: string
  mimeType?: string
  size?: number
  uploadedAt?: string
  checksum?: string
}

interface PaginationMeta {
  page: number
  pages: number
  limit: number
  total: number
}

interface TransactionTableProps {
  transactions: Transaction[]
  pagination: PaginationMeta
  onPageChange: (page: number) => void
  onRefresh: () => void
}

export function TransactionTable({ transactions, pagination, onPageChange, onRefresh }: TransactionTableProps) {
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [imageError, setImageError] = useState(false)

  const receiptMeta =
    selectedTransaction?.type === "deposit" && selectedTransaction.meta?.receipt
      ? (selectedTransaction.meta.receipt as ReceiptMeta)
      : null

  const selectedUser =
    selectedTransaction && typeof selectedTransaction.userId === "object"
      ? selectedTransaction.userId
      : null

  const selectedAmount = selectedTransaction ? Number(selectedTransaction.amount) : Number.NaN

  const resolvedReceiptUrl = useMemo(() => {
    if (!receiptMeta?.url || typeof receiptMeta.url !== "string") {
      return null
    }

    if (/^https?:\/\//i.test(receiptMeta.url)) {
      return receiptMeta.url
    }

    return receiptMeta.url.startsWith("/") ? receiptMeta.url : `/${receiptMeta.url}`
  }, [receiptMeta?.url])

  useEffect(() => {
    setImageError(false)
  }, [resolvedReceiptUrl])

  const paginationStart = (pagination.page - 1) * pagination.limit + 1
  const paginationEnd = Math.min(pagination.page * pagination.limit, pagination.total)
  const hasNextPage = pagination.page < pagination.pages || transactions.length === pagination.limit

  const handlePreviousPage = () => {
    if (pagination.page > 1) {
      onPageChange(pagination.page - 1)
    }
  }

  const handleNextPage = () => {
    if (hasNextPage) {
      onPageChange(pagination.page + 1)
    }
  }

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
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      No transactions found for the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((transaction) => {
                    const userRecord =
                      transaction.userId && typeof transaction.userId === "object"
                        ? transaction.userId
                        : null

                    const amountValue = Number(transaction.amount)
                    const createdAt = transaction.createdAt ? new Date(transaction.createdAt) : null
                    const fallbackIdentifier =
                      userRecord?._id || (typeof transaction.userId === "string" ? transaction.userId : undefined)
                    const isPending = transaction.status === "pending"

                    return (
                      <TableRow key={transaction._id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {userRecord?.name || "Deleted user"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {userRecord?.email || "User record unavailable"}
                            </div>
                            <div className="text-xs font-mono">
                              {userRecord?.referralCode || fallbackIdentifier || "—"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getTypeBadge(transaction.type)}</TableCell>
                        <TableCell className="font-mono">
                          {Number.isFinite(amountValue) ? `$${amountValue.toFixed(2)}` : "—"}
                        </TableCell>
                        <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                        <TableCell>
                          {createdAt && !Number.isNaN(createdAt.getTime())
                            ? createdAt.toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedTransaction(transaction)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {isPending && (
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
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {pagination.total > 0
                ? `Showing ${paginationStart.toLocaleString()}-${paginationEnd.toLocaleString()} of ${pagination.total.toLocaleString()} transactions`
                : "No transactions to display"}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={pagination.page <= 1}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {Math.min(pagination.page, pagination.pages).toLocaleString()} of {Math.max(pagination.pages, 1).toLocaleString()}
              </span>
              <Button variant="outline" size="sm" onClick={handleNextPage} disabled={!hasNextPage}>
                Next
              </Button>
            </div>
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
                  <p className="text-sm">{selectedUser?.name || "Deleted user"}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedUser?.email || "User record unavailable"}
                  </p>
                </div>
                <div>
                  <Label>Type</Label>
                  <p className="text-sm">{selectedTransaction.type}</p>
                </div>
                <div>
                  <Label>Amount</Label>
                  <p className="text-sm font-mono">
                    {Number.isFinite(selectedAmount) ? `$${selectedAmount.toFixed(2)}` : "—"}
                  </p>
                </div>
                <div>
                  <Label>Status</Label>
                  <p className="text-sm">{selectedTransaction.status}</p>
                </div>
              </div>
              {receiptMeta?.url && (
                <div className="space-y-2">
                  <Label>Receipt Screenshot</Label>
                  {resolvedReceiptUrl && !imageError ? (
                    <div className="overflow-hidden rounded-md border bg-muted/60">
                      <img
                        src={resolvedReceiptUrl}
                        alt={`Deposit receipt ${receiptMeta.originalName ?? ""}`}
                        className="max-h-96 w-full bg-background object-contain"
                        onError={() => setImageError(true)}
                      />
                    </div>
                  ) : (
                    <div className="rounded-md border bg-muted/60 p-4 text-sm text-muted-foreground">
                      Receipt preview unavailable. Use the link below to view the original file.
                    </div>
                  )}
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {receiptMeta.originalName && <div>File: {receiptMeta.originalName}</div>}
                    {typeof receiptMeta.size === "number" && (
                      <div>Size: {(receiptMeta.size / 1024 / 1024).toFixed(2)} MB</div>
                    )}
                    {receiptMeta.uploadedAt && (
                      <div>Uploaded: {new Date(receiptMeta.uploadedAt).toLocaleString()}</div>
                    )}
                  </div>
                  {resolvedReceiptUrl && (
                    <a
                      href={resolvedReceiptUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Open full receipt
                    </a>
                  )}
                </div>
              )}

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
