"use client"

import { useState, useEffect } from "react"

import { Sidebar } from "@/components/layout/sidebar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Download, Filter, Loader2, TrendingDown, TrendingUp, DollarSign, Zap } from "lucide-react"

interface Transaction {
  _id: string
  type: string
  amount: number
  status: string
  meta: any
  createdAt: string
}

interface TransactionSummary {
  [key: string]: {
    total: number
    count: number
  }
}

export default function TransactionsPage() {
  const [user, setUser] = useState<any>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<TransactionSummary>({})
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [filters, setFilters] = useState({
    type: "all",
    from: "",
    to: "",
  })

  const fetchTransactions = async (options?: { append?: boolean; cursor?: string }) => {
    const append = options?.append ?? false
    const cursor = options?.cursor

    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }

    try {
      const params = new URLSearchParams()
      params.set("limit", "50")
      if (filters.type && filters.type !== "all") params.set("type", filters.type)
      if (filters.from) params.set("from", filters.from)
      if (filters.to) params.set("to", filters.to)
      if (cursor) params.set("cursor", cursor)

      const response = await fetch(`/api/transactions?${params.toString()}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch transactions (${response.status})`)
      }

      const data = await response.json()
      const incoming: Transaction[] = Array.isArray(data.transactions)
        ? data.transactions
        : Array.isArray(data.data)
          ? data.data
          : []

      setTransactions((prev) => (append ? [...prev, ...incoming] : incoming))
      setSummary(data.summary ?? {})
      setNextCursor(data.nextCursor ?? null)
      setHasMore(Boolean(data.hasMore) && Boolean(data.nextCursor))
    } catch (error) {
      console.error("Failed to fetch transactions:", error)
      if (!append) {
        setTransactions([])
        setSummary({})
        setNextCursor(null)
        setHasMore(false)
      }
    } finally {
      if (append) {
        setLoadingMore(false)
      } else {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const userRes = await fetch("/api/auth/me")
        if (userRes.ok) {
          const userData = await userRes.json()
          setUser(userData.user)
        }
      } catch (error) {
        console.error("Failed to fetch user:", error)
      } finally {
        await fetchTransactions()
      }
    }

    void loadInitialData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFilterChange = () => {
    void fetchTransactions()
  }

  const handleLoadMore = () => {
    if (!nextCursor) return
    void fetchTransactions({ append: true, cursor: nextCursor })
  }

  const exportTransactions = () => {
    const csvContent = [
      ["Date", "Type", "Amount", "Status", "Description"].join(","),
      ...transactions.map((transaction) =>
        [
          new Date(transaction.createdAt).toLocaleDateString(),
          transaction.type,
          transaction.amount.toFixed(2),
          transaction.status,
          transaction.meta?.source || "",
        ].join(","),
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `transactions-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
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
    const config = {
      deposit: { color: "bg-blue-600", icon: TrendingDown },
      withdraw: { color: "bg-orange-600", icon: TrendingUp },
      earn: { color: "bg-green-600", icon: Zap },
      commission: { color: "bg-purple-600", icon: DollarSign },
      bonus: { color: "bg-amber-600", icon: DollarSign },
      adjust: { color: "bg-gray-600", icon: DollarSign },
    }
    const { color, icon: Icon } = config[type as keyof typeof config] || config.adjust
    return (
      <Badge className={`${color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {type}
      </Badge>
    )
  }

  const formatAmount = (amount: number, type: string) => {
    const isPositive = ["deposit", "earn", "commission", "bonus"].includes(type) || amount > 0
    return (
      <span className={isPositive ? "text-green-600" : "text-red-600"}>
        {isPositive ? "+" : ""}${Math.abs(amount).toFixed(2)}
      </span>
    )
  }

  if (loading && !loadingMore) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user} />

      <main className="flex-1 overflow-auto md:ml-64">
        <div className="p-6">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-balance">Transaction History</h1>
              <p className="text-muted-foreground">View all your transactions and earnings</p>
            </div>
            <Button onClick={exportTransactions} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>

          <Tabs defaultValue="transactions" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="transactions">All Transactions</TabsTrigger>
              <TabsTrigger value="summary">Summary</TabsTrigger>
            </TabsList>

            <TabsContent value="transactions" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5" /> Filters
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <div>
                      <Select
                        value={filters.type}
                        onValueChange={(value) => setFilters((prev) => ({ ...prev, type: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Transaction type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          <SelectItem value="deposit">Deposits</SelectItem>
                          <SelectItem value="withdraw">Withdrawals</SelectItem>
                          <SelectItem value="earn">Mining Earnings</SelectItem>
                          <SelectItem value="commission">Commissions</SelectItem>
                          <SelectItem value="bonus">Bonuses</SelectItem>
                          <SelectItem value="adjust">Adjustments</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Input
                        type="date"
                        placeholder="From date"
                        value={filters.from}
                        onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
                      />
                    </div>
                    <div>
                      <Input
                        type="date"
                        placeholder="To date"
                        value={filters.to}
                        onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
                      />
                    </div>
                    <div>
                      <Button onClick={handleFilterChange} className="w-full">
                        Apply Filters
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Transactions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                              No transactions found for the selected filters.
                            </TableCell>
                          </TableRow>
                        ) : (
                          transactions.map((transaction) => (
                            <TableRow key={transaction._id}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">
                                    {new Date(transaction.createdAt).toLocaleDateString()}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {new Date(transaction.createdAt).toLocaleTimeString()}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>{getTypeBadge(transaction.type)}</TableCell>
                              <TableCell className="font-mono">
                                {formatAmount(transaction.amount, transaction.type)}
                              </TableCell>
                              <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                              <TableCell className="max-w-xs">
                                <div className="text-sm">
                                  {transaction.meta?.source && (
                                    <div className="text-muted-foreground">Source: {transaction.meta.source}</div>
                                  )}
                                  {transaction.meta?.reason && (
                                    <div className="text-muted-foreground">Reason: {transaction.meta.reason}</div>
                                  )}
                                  {typeof transaction.meta?.profitPct === "number" && (
                                    <div className="text-green-600">
                                      Profit: {transaction.meta.profitPct.toFixed(2)}%
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {hasMore ? (
                    <div className="flex justify-center border-t border-muted pt-4">
                      <Button onClick={handleLoadMore} disabled={loadingMore} variant="outline">
                        {loadingMore ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading more
                          </span>
                        ) : (
                          "Load more"
                        )}
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="summary" className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Object.keys(summary).length === 0 ? (
                  <Card>
                    <CardContent className="py-10 text-center text-muted-foreground">
                      No summary available for the selected filters.
                    </CardContent>
                  </Card>
                ) : (
                  Object.entries(summary).map(([type, data]) => (
                    <Card key={type}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium capitalize">{type}s</CardTitle>
                        {getTypeBadge(type)}
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">${data.total.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">{data.count} transactions</p>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}

