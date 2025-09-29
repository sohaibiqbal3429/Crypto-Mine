"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Download, Filter, TrendingUp, TrendingDown, DollarSign, Zap } from "lucide-react"

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
  const [filters, setFilters] = useState({
    type: "all",
    from: "",
    to: "",
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [userRes, transactionsRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch(`/api/transactions?type=${filters.type}&from=${filters.from}&to=${filters.to}&limit=50`),
      ])

      if (userRes.ok && transactionsRes.ok) {
        const userData = await userRes.json()
        const transactionsData = await transactionsRes.json()

        setUser(userData.user)
        setTransactions(transactionsData.transactions)
        setSummary(transactionsData.summary)
      }
    } catch (error) {
      console.error("Failed to fetch transactions:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = () => {
    setLoading(true)
    fetchData()
  }

  const exportTransactions = () => {
    const csvContent = [
      ["Date", "Type", "Amount", "Status", "Description"].join(","),
      ...transactions.map((t) =>
        [new Date(t.createdAt).toLocaleDateString(), t.type, t.amount.toFixed(2), t.status, t.meta?.source || ""].join(
          ",",
        ),
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user} />

      <main className="flex-1 md:ml-64 overflow-auto">
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
              {/* Filters */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    Filters
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                        onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Input
                        type="date"
                        placeholder="To date"
                        value={filters.to}
                        onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
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

              {/* Transactions Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              No transactions found
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
                                  {transaction.meta?.profitPct && (
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
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="summary" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(summary).map(([type, data]) => (
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
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
