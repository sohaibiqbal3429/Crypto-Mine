"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { TransactionTable, type TransactionFilters } from "@/components/admin/transaction-table"
import { UserTable, type UserFilters } from "@/components/admin/user-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw } from "lucide-react"
import { AdminDepositsTable } from "@/components/admin/deposit-reviews"
import { AdminWinnerBox } from "@/components/admin/winner-announcement"
import { useToast } from "@/components/ui/use-toast"
import { useLuckyDrawDeposits } from "@/hooks/use-lucky-draw-deposits"
import type { LuckyDrawRound } from "@/lib/types/lucky-draw"
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
  const { toast } = useToast()

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

  const transactionCursorRef = useRef<string | null>(null)
  const transactionLoadingRef = useRef(false)
  const userCursorRef = useRef<string | null>(null)
  const userLoadingRef = useRef(false)

  const {
    deposits: luckyDeposits,
    updateDepositStatus,
    loading: luckyDepositsLoading,
    error: luckyDepositsError,
    refresh: refreshLuckyDeposits,
  } = useLuckyDrawDeposits({ scope: "admin", autoRefresh: false })

  const [luckyRound, setLuckyRound] = useState<LuckyDrawRound>({
    id: "demo-round",
    startAtUtc: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    endAtUtc: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    prizePoolUsd: 30,
    lastWinner: {
      name: "Wallet Ninja",
      announcedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
  })
  const [roundHistory, setRoundHistory] = useState([
    {
      id: "round-001",
      winner: "Wallet Ninja",
      announcedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      prizeUsd: 30,
    },
  ])
  const [announcingWinner, setAnnouncingWinner] = useState(false)

  const currentRound = useMemo(
    () => ({
      ...luckyRound,
      totalEntries: luckyDeposits.filter((deposit) => deposit.status === "APPROVED").length,
    }),
    [luckyRound, luckyDeposits],
  )

  const handleAcceptDeposit = useCallback(
    async (depositId: string) => {
      const target = luckyDeposits.find((deposit) => deposit.id === depositId)
      if (!target || target.status === "APPROVED") return

      try {
        const changed = await updateDepositStatus(depositId, "APPROVED")
        if (!changed) return

        toast({
          description: `${target.userName ?? "Participant"}'s deposit has been approved and entered into the current round.`,
        })
      } catch (error) {
        console.error(error)
        toast({
          variant: "destructive",
          description:
            error instanceof Error ? error.message : "Unable to approve deposit. Please try again.",
        })
      }
    },
    [luckyDeposits, toast, updateDepositStatus],
  )

  const handleRejectDeposit = useCallback(
    async (depositId: string) => {
      const target = luckyDeposits.find((deposit) => deposit.id === depositId)
      if (!target || target.status === "REJECTED") return

      try {
        let note: string | undefined
        if (typeof window !== "undefined") {
          const input = window.prompt("Add an optional note for the participant (optional):", "")
          if (input !== null) {
            note = input.trim().length > 0 ? input.trim() : undefined
          }
        }

        const changed = await updateDepositStatus(depositId, "REJECTED", note)
        if (!changed) return

        toast({ variant: "destructive", description: `${target.userName ?? "Participant"}'s deposit has been rejected.` })
      } catch (error) {
        console.error(error)
        toast({
          variant: "destructive",
          description:
            error instanceof Error ? error.message : "Unable to reject deposit. Please try again.",
        })
      }
    },
    [luckyDeposits, toast, updateDepositStatus],
  )

  const handleAnnounceWinner = useCallback(
    (depositId: string) => {
      const winnerDeposit = luckyDeposits.find((deposit) => deposit.id === depositId && deposit.status === "APPROVED")
      if (!winnerDeposit) {
        toast({ variant: "destructive", description: "Select an accepted deposit before announcing a winner." })
        return
      }

      setAnnouncingWinner(true)
      setTimeout(() => {
        const announcementTime = new Date().toISOString()
        setLuckyRound((prev) => ({
          ...prev,
          lastWinner: {
            name: winnerDeposit.userName ?? "Participant",
            announcedAt: announcementTime,
          },
        }))
        setRoundHistory((prev) => [
          {
            id: `history-${announcementTime}`,
            winner: winnerDeposit.userName ?? "Participant",
            announcedAt: announcementTime,
            prizeUsd: luckyRound.prizePoolUsd,
          },
          ...prev,
        ])
        toast({
          description: `${winnerDeposit.userName ?? "Participant"} has been announced as the Blind Box winner. $${luckyRound.prizePoolUsd.toFixed(2)} credited automatically.`,
        })
        setAnnouncingWinner(false)
      }, 400)
    },
    [luckyDeposits, luckyRound.prizePoolUsd, toast],
  )

  useEffect(() => {
    setStats((prev) => ({
      ...prev,
      pendingLuckyDrawDeposits: luckyDeposits.filter((deposit) => deposit.status === "PENDING").length,
    }))
  }, [luckyDeposits])

  const fetchStats = useCallback(async () => {
    const response = await fetch("/api/admin/stats")
    if (!response.ok) {
      return
    }
    const payload = await response.json()
    if (payload.stats) {
      setStats((prev) => ({ ...prev, ...payload.stats }))
    }
  }, [])

  const fetchTransactions = useCallback(
    async (options: { reset?: boolean } = {}) => {
      if (transactionLoadingRef.current) return
      const isReset = options.reset ?? false
      transactionLoadingRef.current = true
      setTransactionLoading(true)
      setTransactionError(null)

      const params = new URLSearchParams()
      params.set("limit", String(TRANSACTION_LIMIT))
      for (const [key, value] of Object.entries(transactionFilters)) {
        if (value) params.set(key, value)
      }

      const cursorToUse = isReset ? null : transactionCursorRef.current
      if (cursorToUse) {
        params.set("cursor", cursorToUse)
      }

      try {
        if (isReset) {
          transactionCursorRef.current = null
          setTransactionCursor(null)
          setTransactionHasMore(false)
        }
        const response = await fetch(`/api/admin/transactions?${params.toString()}`)
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || "Unable to load transactions")
        }
        const payload = await response.json()
        const nextCursor = payload.nextCursor ?? null
        transactionCursorRef.current = nextCursor
        setTransactionCursor(nextCursor)
        setTransactionHasMore(Boolean(nextCursor))
        setTransactions((prev) => (isReset ? payload.data : [...prev, ...payload.data]))
      } catch (error) {
        console.error(error)
        setTransactionError(error instanceof Error ? error.message : "Unable to load transactions")
      } finally {
        transactionLoadingRef.current = false
        setTransactionLoading(false)
      }
    },
    [transactionFilters],
  )

  const fetchUsers = useCallback(
    async (options: { reset?: boolean } = {}) => {
      if (userLoadingRef.current) return
      const isReset = options.reset ?? false
      userLoadingRef.current = true
      setUserLoading(true)
      setUserError(null)

      const params = new URLSearchParams()
      params.set("limit", String(USER_LIMIT))
      for (const [key, value] of Object.entries(userFilters)) {
        if (value) params.set(key, value)
      }

      const cursorToUse = isReset ? null : userCursorRef.current
      if (cursorToUse) {
        params.set("cursor", cursorToUse)
      }

      try {
        if (isReset) {
          userCursorRef.current = null
          setUserCursor(null)
          setUserHasMore(false)
        }
        const response = await fetch(`/api/admin/users?${params.toString()}`)
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || "Unable to load users")
        }
        const payload = await response.json()
        const nextCursor = payload.nextCursor ?? null
        userCursorRef.current = nextCursor
        setUserCursor(nextCursor)
        setUserHasMore(Boolean(nextCursor))
        setUsers((prev) => (isReset ? payload.data : [...prev, ...payload.data]))
      } catch (error) {
        console.error(error)
        setUserError(error instanceof Error ? error.message : "Unable to load users")
      } finally {
        userLoadingRef.current = false
        setUserLoading(false)
      }
    },
    [userFilters],
  )

  useEffect(() => {
    fetchTransactions({ reset: true }).catch(() => null)
  }, [fetchTransactions])

  useEffect(() => {
    fetchUsers({ reset: true }).catch(() => null)
  }, [fetchUsers])

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
    transactionCursorRef.current = null
    userCursorRef.current = null
    setTransactionCursor(null)
    setUserCursor(null)
    await Promise.all([fetchTransactions({ reset: true }), fetchUsers({ reset: true }), fetchStats()])
  }, [fetchStats, fetchTransactions, fetchUsers])

  useEffect(() => {
    fetchStats().catch(() => null)
  }, [fetchStats])

  const handleTransactionFiltersChange = useCallback((next: TransactionFilters) => {
    transactionCursorRef.current = null
    setTransactionCursor(null)
    setTransactionFilters(next)
  }, [])

  const handleUserFiltersChange = useCallback((next: UserFilters) => {
    userCursorRef.current = null
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

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Total users" value={stats.totalUsers.toLocaleString()} />
            <StatCard label="Active users" value={stats.activeUsers.toLocaleString()} />
            <StatCard label="Pending deposits" value={stats.pendingDeposits.toLocaleString()} />
            <StatCard label="Pending withdrawals" value={stats.pendingWithdrawals.toLocaleString()} />
            <StatCard
              label="Lucky draw pending"
              value={stats.pendingLuckyDrawDeposits.toLocaleString()}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <AdminDepositsTable
                deposits={luckyDeposits}
                loading={luckyDepositsLoading}
                error={luckyDepositsError}
                onRefresh={refreshLuckyDeposits}
                onAccept={handleAcceptDeposit}
                onReject={handleRejectDeposit}
              />
            </div>
            <AdminWinnerBox
              round={currentRound}
              deposits={luckyDeposits}
              onAnnounceWinner={handleAnnounceWinner}
              announcing={announcingWinner}
              history={roundHistory}
            />
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
