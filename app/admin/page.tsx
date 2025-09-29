"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { TransactionTable } from "@/components/admin/transaction-table"
import { UserTable } from "@/components/admin/user-table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, Users, DollarSign, Clock } from "lucide-react"

interface AdminStats {
  totalUsers: number
  activeUsers: number
  pendingDeposits: number
  pendingWithdrawals: number
  totalDeposits: number
  totalWithdrawals: number
}

export default function AdminPage() {
  const [user, setUser] = useState<any>(null)
  const [transactions, setTransactions] = useState([])
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")

  // Filters
  const [transactionFilters, setTransactionFilters] = useState({
    type: "all", // Updated default value
    status: "all", // Updated default value
  })
  const [userSearch, setUserSearch] = useState("")

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [userRes, transactionsRes, usersRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch(`/api/admin/transactions?type=${transactionFilters.type}&status=${transactionFilters.status}`),
        fetch(`/api/admin/users?search=${userSearch}`),
      ])

      if (userRes.ok && transactionsRes.ok && usersRes.ok) {
        const userData = await userRes.json()
        const transactionsData = await transactionsRes.json()
        const usersData = await usersRes.json()

        setUser(userData.user)
        setTransactions(transactionsData.transactions)
        setUsers(usersData.users)

        // Calculate stats
        const totalUsers = usersData.users.length
        const activeUsers = usersData.users.filter((u: any) => u.isActive).length
        const pendingDeposits = transactionsData.transactions.filter(
          (t: any) => t.type === "deposit" && t.status === "pending",
        ).length
        const pendingWithdrawals = transactionsData.transactions.filter(
          (t: any) => t.type === "withdraw" && t.status === "pending",
        ).length

        setStats({
          totalUsers,
          activeUsers,
          pendingDeposits,
          pendingWithdrawals,
          totalDeposits: usersData.users.reduce((sum: number, u: any) => sum + u.depositTotal, 0),
          totalWithdrawals: usersData.users.reduce((sum: number, u: any) => sum + u.withdrawTotal, 0),
        })
      }
    } catch (error) {
      console.error("Failed to fetch admin data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = () => {
    fetchData()
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
              <h1 className="text-3xl font-bold text-balance">Admin Panel</h1>
              <p className="text-muted-foreground">Manage users, transactions, and platform settings</p>
            </div>
            <Button onClick={fetchData} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
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
              <div className="flex gap-4">
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

                <Button onClick={handleFilterChange}>Apply Filters</Button>
              </div>

              <TransactionTable transactions={transactions} onRefresh={fetchData} />
            </TabsContent>

            <TabsContent value="users" className="space-y-6">
              <div className="flex gap-4">
                <Input
                  placeholder="Search users..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="max-w-sm"
                />
                <Button onClick={handleFilterChange}>Search</Button>
              </div>

              <UserTable users={users} onRefresh={fetchData} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
