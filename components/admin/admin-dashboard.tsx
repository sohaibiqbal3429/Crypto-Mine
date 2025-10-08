"use client"

import { useCallback, useEffect, useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { TransactionTable, type TransactionFilters } from "@/components/admin/transaction-table"
import { UserTable, type UserFilters } from "@/components/admin/user-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw } from "lucide-react"
import type {
  AdminSessionUser,
  AdminStats,
  AdminTransactionRecord,
  AdminUserRecord,
} from "@/lib/types/admin"

interface AdminDashboardProps {
  initialUser: AdminSessionUser
  initialStats: AdminStats
  initialError?: string | null
}

const TRANSACTION_LIMIT = 50
const USER_LIMIT = 100

export function AdminDashboard({ initialUser, initialStats, initialError = null }: AdminDashboardProps) {
  const [user, setUser] = useState(initialUser)
  const [stats, setStats] = useState(initialStats)

  const [transactions, setTransactions] = useState<AdminTransactionRecord[]>([])
  const [transactionCursor, setTransactionCursor] = useState<string | null>(null)
  const [transactionHasMore, setTransactionHasMore] = useState(false)
  const [transactionFilters, setTransactionFilters] = useState<TransactionFilters>({})
  const [transactionLoading, setTransactionLoading] = useState(false)
  const [transactionError, setTransactionError] = useState<string | null>(initialError)

  const [users, setUsers] = useState<AdminUserRecord[]>([])
  const [userCursor, setUserCursor] = useState<string | null>(null)
  const [userHasMore, setUserHasMore] = useState(false)
  const [userFilters, setUserFilters] = useState<UserFilters>({})
  const [userLoading, setUserLoading] = useState(false)
  const [userError, setUserError] = useState<string | null>(initialError)

  const fetchStats = useCallback(async () => {
    const response = await fetch("/api/admin/stats")
    if (!response.ok) {
      return
    }
    const payload = await response.json()
    if (payload.stats) {
      setStats(payload.stats)
    }
  }, [])

  const fetchTransactions = useCallback(
    async (options: { reset?: boolean } = {}) => {
      if (transactionLoading) return
      const isReset = options.reset ?? false
      setTransactionLoading(true)
      setTransactionError(null)

      const params = new URLSearchParams()
      params.set("limit", String(TRANSACTION_LIMIT))
      const filterEntries = Object.entries(transactionFilters)
      for (const [key, value] of filterEntries) {
        if (value) params.set(key, value)
      }
      if (!isReset && transactionCursor) {
        params.set("cursor", transactionCursor)
      }

      try {
        const response = await fetch(`/api/admin/transactions?${params.toString()}`)
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || "Unable to load transactions")
        }
        const payload = await response.json()
        const nextCursor = payload.nextCursor ?? null
        setTransactionCursor(nextCursor)
        setTransactionHasMore(Boolean(nextCursor))
        setTransactions((prev) => (isReset ? payload.data : [...prev, ...payload.data]))
      } catch (error) {
        console.error(error)
        setTransactionError(error instanceof Error ? error.message : "Unable to load transactions")
      } finally {
        setTransactionLoading(false)
      }
    },
    [transactionCursor, transactionFilters, transactionLoading],
  )

  const fetchUsers = useCallback(
    async (options: { reset?: boolean } = {}) => {
      if (userLoading) return
      const isReset = options.reset ?? false
      setUserLoading(true)
      setUserError(null)

      const params = new URLSearchParams()
      params.set("limit", String(USER_LIMIT))
      const filterEntries = Object.entries(userFilters)
      for (const [key, value] of filterEntries) {
        if (value) params.set(key, value)
      }
      if (!isReset && userCursor) {
        params.set("cursor", userCursor)
      }

      try {
        const response = await fetch(`/api/admin/users?${params.toString()}`)
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || "Unable to load users")
        }
        const payload = await response.json()
        const nextCursor = payload.nextCursor ?? null
        setUserCursor(nextCursor)
        setUserHasMore(Boolean(nextCursor))
        setUsers((prev) => (isReset ? payload.data : [...prev, ...payload.data]))
      } catch (error) {
        console.error(error)
        setUserError(error instanceof Error ? error.message : "Unable to load users")
      } finally {
        setUserLoading(false)
      }
    },
    [userCursor, userFilters, userLoading],
  )

  useEffect(() => {
    fetchTransactions({ reset: true })
  }, [fetchTransactions, transactionFilters])

  useEffect(() => {
    fetchUsers({ reset: true })
  }, [fetchUsers, userFilters])

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (payload?.user) {
          setUser((prev) => ({ ...prev, ...payload.user }))
        }
      })
      .catch(() => null)
  }, [])

  const refreshAll = useCallback(async () => {
    setTransactionCursor(null)
    setUserCursor(null)
    await Promise.all([fetchTransactions({ reset: true }), fetchUsers({ reset: true }), fetchStats()])
  }, [fetchStats, fetchTransactions, fetchUsers])

  useEffect(() => {
    fetchStats().catch(() => null)
  }, [fetchStats])

  const handleTransactionFiltersChange = useCallback((next: TransactionFilters) => {
    setTransactionCursor(null)
    setTransactionFilters(next)
  }, [])

  const handleUserFiltersChange = useCallback((next: UserFilters) => {
    setUserCursor(null)
    setUserFilters(next)
  }, [])

  const handleExportTransactions = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/transactions/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transactionFilters),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Failed to queue export")
      }
      alert("Export queued. You will receive an email when it is ready.")
    } catch (error) {
      console.error(error)
      setTransactionError(error instanceof Error ? error.message : "Unable to queue export")
    }
  }, [transactionFilters])

  if (!user) {
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
        <div className="space-y-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Admin Panel</h1>
              <p className="text-sm text-muted-foreground">Monitor platform performance and review user activity.</p>
            </div>
            <Button onClick={refreshAll} variant="secondary" className="gap-2" disabled={transactionLoading || userLoading}>
              {transactionLoading || userLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total users" value={stats.totalUsers.toLocaleString()} />
            <StatCard label="Active users" value={stats.activeUsers.toLocaleString()} />
            <StatCard label="Pending deposits" value={stats.pendingDeposits.toLocaleString()} />
            <StatCard label="Pending withdrawals" value={stats.pendingWithdrawals.toLocaleString()} />
          </div>

          <TransactionTable
            items={transactions}
            loading={transactionLoading}
            error={transactionError}
            hasMore={transactionHasMore}
            onLoadMore={() => fetchTransactions()}
            onRefresh={() => fetchTransactions({ reset: true })}
            onExport={handleExportTransactions}
            filters={transactionFilters}
            onFiltersChange={handleTransactionFiltersChange}
          />

          <UserTable
            items={users}
            loading={userLoading}
            error={userError}
            hasMore={userHasMore}
            onLoadMore={() => fetchUsers()}
            onRefresh={() => fetchUsers({ reset: true })}
            filters={userFilters}
            onFiltersChange={handleUserFiltersChange}
          />
        </div>
      </main>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  )
}
