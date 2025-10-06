"use client"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { TransactionTable } from "@/components/admin/transaction-table"
import { UserTable } from "@/components/admin/user-table"
import { LuckyDrawPanel } from "@/components/admin/lucky-draw-panel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Clock, DollarSign, Loader2, RefreshCw, Users } from "lucide-react"
import type {
  AdminStats,
  AdminSessionUser,
  AdminTransactionRecord,
  AdminUserRecord,
} from "@/lib/types/admin"

interface AdminDashboardProps {
  initialUser: AdminSessionUser
  initialTransactions: AdminTransactionRecord[]
  initialUsers: AdminUserRecord[]
  initialStats: AdminStats
  initialError?: string | null
}

const computeStats = (users: AdminUserRecord[], transactions: AdminTransactionRecord[]): AdminStats => ({
  totalUsers: users.length,
  activeUsers: users.filter((user) => user.isActive).length,
  pendingDeposits: transactions.filter((tx) => tx.type === "deposit" && tx.status === "pending").length,
  pendingWithdrawals: transactions.filter((tx) => tx.type === "withdraw" && tx.status === "pending").length,
  totalDeposits: users.reduce((sum, user) => sum + user.depositTotal, 0),
  totalWithdrawals: users.reduce((sum, user) => sum + user.withdrawTotal, 0),
})

export function AdminDashboard({
  initialUser,
  initialTransactions,
  initialUsers,
  initialStats,
  initialError = null,
}: AdminDashboardProps) {
  const TRANSACTION_PAGE_SIZE = 20
  const USER_PAGE_SIZE = 100
  const [user, setUser] = useState(initialUser)
  const [transactions, setTransactions] = useState(initialTransactions)
  const [users, setUsers] = useState(initialUsers)
  const [stats, setStats] = useState<AdminStats>(initialStats)
  const [loading, setLoading] = useState(false)
  const [pageError, setPageError] = useState<string | null>(initialError)
  const [activeTab, setActiveTab] = useState("overview")

  const [transactionFilters, setTransactionFilters] = useState({
    type: "all",
    status: "all",
  })
  const [userSearch, setUserSearch] = useState("")
  const [transactionPagination, setTransactionPagination] = useState({
    page: 1,
    pages: Math.max(1, Math.ceil(initialTransactions.length / TRANSACTION_PAGE_SIZE) || 1),
    limit: TRANSACTION_PAGE_SIZE,
    total: initialTransactions.length,
  })
  const [userPagination, setUserPagination] = useState({
    page: 1,
    pages: Math.max(1, Math.ceil(initialUsers.length / USER_PAGE_SIZE) || 1),
    limit: USER_PAGE_SIZE,
    total: initialUsers.length,
  })

  useEffect(() => {
    if (initialError) {
      fetchData({ transactionPage: 1, userPage: 1 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const fetchData = async ({
    transactionPage,
    userPage,
  }: {
    transactionPage?: number
    userPage?: number
  } = {}) => {
    try {
      setLoading(true)
      setPageError(null)

      const transactionParams = new URLSearchParams()
      const nextTransactionPage = transactionPage ?? transactionPagination.page
      const nextUserPage = userPage ?? userPagination.page

      transactionParams.set("page", nextTransactionPage.toString())
      transactionParams.set("limit", TRANSACTION_PAGE_SIZE.toString())
      if (transactionFilters.type !== "all") {
        transactionParams.set("type", transactionFilters.type)
      }
      if (transactionFilters.status !== "all") {
        transactionParams.set("status", transactionFilters.status)
      }

      const userParams = new URLSearchParams()
      userParams.set("page", nextUserPage.toString())
      userParams.set("limit", USER_PAGE_SIZE.toString())
      const sanitizedSearch = userSearch.trim()
      if (sanitizedSearch.length > 0) {
        userParams.set("search", sanitizedSearch)
      }

      const [userRes, transactionsRes, usersRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch(`/api/admin/transactions${transactionParams.toString() ? `?${transactionParams.toString()}` : ""}`),
        fetch(`/api/admin/users${userParams.toString() ? `?${userParams.toString()}` : ""}`),
      ])

      if (!userRes.ok) {
        throw new Error("Unable to load admin user context")
      }
      if (!transactionsRes.ok) {
        const data = await transactionsRes.json().catch(() => ({}))
        throw new Error(data.error || "Unable to load transactions")
      }
      if (!usersRes.ok) {
        const data = await usersRes.json().catch(() => ({}))
        throw new Error(data.error || "Unable to load users")
      }

      const userData = await userRes.json()
      const transactionsData = await transactionsRes.json()
      const usersData = await usersRes.json()

      setUser(userData.user)
      setTransactions(transactionsData.transactions || [])
      setUsers(usersData.users || [])
      setStats(computeStats(usersData.users || [], transactionsData.transactions || []))
      if (transactionsData.pagination) {
        const { page, pages, limit, total } = transactionsData.pagination
        setTransactionPagination({
          page: Math.max(1, page || nextTransactionPage),
          pages: Math.max(1, pages || 1),
          limit: limit || TRANSACTION_PAGE_SIZE,
          total: total || 0,
        })
      }
      if (usersData.pagination) {
        const { page, pages, limit, total } = usersData.pagination
        setUserPagination({
          page: Math.max(1, page || nextUserPage),
          pages: Math.max(1, pages || 1),
          limit: limit || USER_PAGE_SIZE,
          total: total || 0,
        })
      }
    } catch (error: any) {
      console.error("Failed to fetch admin data:", error)
      setPageError(error?.message || "Failed to refresh admin data")
    } finally {
      setLoading(false)
    }
  }

  const handleApplyTransactionFilters = () => {
    fetchData({ transactionPage: 1 })
  }

  const handleApplyUserSearch = () => {
    fetchData({ userPage: 1 })
  }

  if (loading && !transactions.length && !users.length) {
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
          <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold text-balance">Admin Panel</h1>
              <p className="text-muted-foreground">Manage users, transactions, and platform settings</p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Button
                onClick={() => fetchData({ transactionPage: 1, userPage: 1 })}
                variant="secondary"
                className="flex items-center gap-2 rounded-2xl border border-border bg-card px-6 py-5 text-base font-semibold shadow-sm hover:bg-muted"
                disabled={loading}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
                Refresh
              </Button>
            </div>
          </div>

          {pageError && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{pageError}</AlertDescription>
            </Alert>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="lucky-draw">Lucky Draw</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.totalUsers}</div>
                      <p className="text-xs text-muted-foreground">{stats.activeUsers} active users</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Pending Deposits</CardTitle>
                      <Clock className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-orange-600">{stats.pendingDeposits}</div>
                      <p className="text-xs text-muted-foreground">Awaiting approval</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Pending Withdrawals</CardTitle>
                      <Clock className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">{stats.pendingWithdrawals}</div>
                      <p className="text-xs text-muted-foreground">Awaiting approval</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
                      <DollarSign className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        ${(stats.totalDeposits + stats.totalWithdrawals).toFixed(0)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        ${stats.totalDeposits.toFixed(0)} in / ${stats.totalWithdrawals.toFixed(0)} out
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="transactions" className="space-y-6">
              <div className="flex gap-4 flex-wrap">
                <Select
                  value={transactionFilters.type}
                  onValueChange={(value) => setTransactionFilters((prev) => ({ ...prev, type: value }))}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="deposit">Deposits</SelectItem>
                    <SelectItem value="withdraw">Withdrawals</SelectItem>
                    <SelectItem value="earn">Earnings</SelectItem>
                    <SelectItem value="commission">Commissions</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={transactionFilters.status}
                  onValueChange={(value) => setTransactionFilters((prev) => ({ ...prev, status: value }))}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>

                <Button onClick={handleApplyTransactionFilters} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Apply Filters
                </Button>
              </div>

              <TransactionTable
                transactions={transactions}
                pagination={transactionPagination}
                onPageChange={(page) => fetchData({ transactionPage: page })}
                onRefresh={() => fetchData({ transactionPage: transactionPagination.page, userPage: userPagination.page })}
              />
            </TabsContent>

            <TabsContent value="users" className="space-y-6">
              <div className="flex gap-4 flex-wrap">
                <Input
                  placeholder="Search users..."
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  className="max-w-sm"
                />
                <Button onClick={handleApplyUserSearch} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Search
                </Button>
              </div>

              <UserTable
                users={users}
                pagination={userPagination}
                onPageChange={(page) => fetchData({ userPage: page })}
                onRefresh={() => fetchData({ transactionPage: transactionPagination.page, userPage: userPagination.page })}
              />
            </TabsContent>
            <TabsContent value="lucky-draw">
              <LuckyDrawPanel />
            </TabsContent>
          </Tabs>

        </div>
      </main>
    </div>
  )
}

