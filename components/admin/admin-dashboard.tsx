"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react"
import { format } from "date-fns"
import { Sidebar } from "@/components/layout/sidebar"
import { TransactionTable, type TransactionFilters } from "@/components/admin/transaction-table"
import { UserTable, type UserFilters } from "@/components/admin/user-table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw } from "lucide-react"
import { AdminDepositsTable } from "@/components/admin/deposit-reviews"
import { AdminWinnerBox } from "@/components/admin/winner-announcement"
import { useToast } from "@/components/ui/use-toast"
import { useLuckyDrawDeposits } from "@/hooks/use-lucky-draw-deposits"
import type { LuckyDrawRound } from "@/lib/types/lucky-draw"
import { formatNumberWithFallback } from "@/lib/utils/safe-parsing"
import type {
  AdminSessionUser,
  AdminStats,
  AdminTransactionRecord,
  AdminUserRecord,
  AdminPlatformSettings,
} from "@/lib/types/admin"
import { Input } from "@/components/ui/input"
import { multiplyAmountByPercent } from "@/lib/utils/numeric"

type JsonRecord = Record<string, unknown>

interface TransactionsResponse extends JsonRecord {
  data?: AdminTransactionRecord[]
  nextCursor?: unknown
  error?: unknown
}

interface UsersResponse extends JsonRecord {
  data?: AdminUserRecord[]
  nextCursor?: unknown
  error?: unknown
}

interface StatsResponse extends JsonRecord {
  stats?: Partial<AdminStats>
  error?: unknown
}

async function readJsonSafe<T extends JsonRecord>(response: Response): Promise<T | null> {
  try {
    const clone = response.clone()
    const text = await clone.text()
    if (!text) {
      return null
    }

    try {
      return JSON.parse(text) as T
    } catch (parseError) {
      console.error("Failed to parse JSON response", parseError, {
        preview: text.slice(0, 200),
      })
      return null
    }
  } catch (error) {
    console.error("Unexpected error while reading response", error)
    return null
  }
}

function normalizeAdminStats(stats: Partial<AdminStats> | null | undefined): Partial<AdminStats> {
  if (!stats || typeof stats !== "object") {
    return {}
  }

  const numericKeys: Array<keyof AdminStats> = [
    "totalUsers",
    "activeUsers",
    "pendingDeposits",
    "pendingWithdrawals",
    "totalDeposits",
    "totalWithdrawals",
    "pendingLuckyDrawDeposits",
  ]

  const safeStats: Partial<AdminStats> = {}
  for (const key of numericKeys) {
    const value = stats[key]
    if (typeof value === "number" && Number.isFinite(value)) {
      safeStats[key] = value
    }
  }

  return safeStats
}

interface AdminDashboardProps {
  initialUser: AdminSessionUser
  initialStats: AdminStats
  initialSettings: AdminPlatformSettings
  initialError?: string | null
}

const TRANSACTION_LIMIT = 50
const USER_LIMIT = 100
interface PendingAnnouncement {
  id: string
  winner: string
  announcementAt: string
  prizeUsd: number
}

export function AdminDashboard({ initialUser, initialStats, initialSettings, initialError = null }: AdminDashboardProps) {
  const [user, setUser] = useState(initialUser)
  const [stats, setStats] = useState(initialStats)
  const { toast } = useToast()

  const [dailyProfitPercent, setDailyProfitPercent] = useState(initialSettings.dailyProfitPercent)
  const [dailyProfitDraft, setDailyProfitDraft] = useState(() => initialSettings.dailyProfitPercent.toFixed(2))
  const [dailyProfitBounds, setDailyProfitBounds] = useState(
    initialSettings.bounds ?? { min: 0, max: 10 },
  )
  const [dailyProfitLoading, setDailyProfitLoading] = useState(false)
  const [dailyProfitSaving, setDailyProfitSaving] = useState(false)
  const [dailyProfitError, setDailyProfitError] = useState<string | null>(null)

  // Team daily profit override (optional, when null use level defaults)
  const [teamDailyProfitPercent, setTeamDailyProfitPercent] = useState<number | null>(null)
  const [teamDailyDraft, setTeamDailyDraft] = useState<string>("")
  const [teamDailyBounds, setTeamDailyBounds] = useState<{ min: number; max: number }>({ min: 0, max: 10 })
  const [teamDailyLoading, setTeamDailyLoading] = useState(false)
  const [teamDailySaving, setTeamDailySaving] = useState(false)
  const [teamDailyError, setTeamDailyError] = useState<string | null>(null)

  const dailyProfitDraftExample = useMemo(
    () => multiplyAmountByPercent(100, dailyProfitDraft),
    [dailyProfitDraft],
  )
  const savedDailyProfitExample = useMemo(
    () => multiplyAmountByPercent(100, dailyProfitPercent),
    [dailyProfitPercent],
  )

  const dailyProfitDraftTrimmed = dailyProfitDraft.trim()
  const disableDailyProfitSave = dailyProfitSaving || dailyProfitLoading || dailyProfitDraftTrimmed.length === 0

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
  const lastStatsErrorRef = useRef<string | null>(null)
  const announceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef(true)

  const runIfMounted = useCallback((callback: () => void) => {
    if (isMountedRef.current) {
      callback()
    }
  }, [])

  useEffect(() => {
    return () => {
      isMountedRef.current = false
      if (announceTimeoutRef.current) {
        clearTimeout(announceTimeoutRef.current)
      }
    }
  }, [])

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
    announcementAtUtc: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    selectedWinner: null,
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
  const [pendingAnnouncement, setPendingAnnouncement] = useState<PendingAnnouncement | null>(null)

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

  const handleDailyProfitDraftChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setDailyProfitDraft(event.target.value)
  }, [])

  const fetchDailyProfitSettings = useCallback(async () => {
    runIfMounted(() => {
      setDailyProfitLoading(true)
      setDailyProfitError(null)
    })

    try {
      const response = await fetch("/api/admin/settings/daily-profit-percent", { cache: "no-store" })
      const payload = await readJsonSafe<{
        dailyProfitPercent?: number
        bounds?: { min: number; max: number }
        error?: unknown
      }>(response)

      if (!response.ok) {
        const message = typeof payload?.error === "string" ? payload.error : "Unable to load daily profit percent"
        throw new Error(message)
      }

      const nextPercent =
        typeof payload?.dailyProfitPercent === "number" && Number.isFinite(payload.dailyProfitPercent)
          ? payload.dailyProfitPercent
          : dailyProfitPercent

      const nextBounds =
        payload?.bounds && typeof payload.bounds.min === "number" && typeof payload.bounds.max === "number"
          ? payload.bounds
          : null

      runIfMounted(() => {
        setDailyProfitPercent(nextPercent)
        setDailyProfitDraft(nextPercent.toFixed(2))
        if (nextBounds) {
          setDailyProfitBounds(nextBounds)
        }
      })
    } catch (error) {
      console.error(error)
      runIfMounted(() =>
        setDailyProfitError(
          error instanceof Error ? error.message : "Unable to load daily profit percent",
        ),
      )
    } finally {
      runIfMounted(() => setDailyProfitLoading(false))
    }
  }, [dailyProfitPercent, runIfMounted])

  const handleDailyProfitRefresh = useCallback(() => {
    fetchDailyProfitSettings().catch(() => null)
  }, [fetchDailyProfitSettings])

  const handleSaveDailyProfitPercent = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      runIfMounted(() => {
        setDailyProfitSaving(true)
        setDailyProfitError(null)
      })

      try {
        const response = await fetch("/api/admin/settings/daily-profit-percent", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ percent: dailyProfitDraft }),
        })

        const payload = await readJsonSafe<{
          dailyProfitPercent?: number
          bounds?: { min: number; max: number }
          error?: unknown
        }>(response)

        if (!response.ok) {
          const message =
            typeof payload?.error === "string" ? payload.error : "Unable to update daily profit percent"
          throw new Error(message)
        }

        const parsedDraft = Number.parseFloat(dailyProfitDraft)
        const updatedPercent =
          typeof payload?.dailyProfitPercent === "number" && Number.isFinite(payload.dailyProfitPercent)
            ? payload.dailyProfitPercent
            : parsedDraft

        const nextPercent = Number.isFinite(updatedPercent) ? updatedPercent : dailyProfitPercent
        const nextBounds =
          payload?.bounds && typeof payload.bounds.min === "number" && typeof payload.bounds.max === "number"
            ? payload.bounds
            : null

        runIfMounted(() => {
          setDailyProfitPercent(nextPercent)
          setDailyProfitDraft(nextPercent.toFixed(2))
          if (nextBounds) {
            setDailyProfitBounds(nextBounds)
          }
        })

        toast({ description: `Daily profit percent updated to ${nextPercent.toFixed(2)}%.` })
      } catch (error) {
        console.error(error)
        runIfMounted(() =>
          setDailyProfitError(
            error instanceof Error ? error.message : "Unable to update daily profit percent",
          ),
        )
      } finally {
        runIfMounted(() => setDailyProfitSaving(false))
      }
    },
    [dailyProfitDraft, dailyProfitPercent, runIfMounted, toast],
  )

  // Team daily profit percent (override) handlers
  const handleTeamDailyDraftChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setTeamDailyDraft(event.target.value)
  }, [])

  const fetchTeamDailyProfitSettings = useCallback(async () => {
    runIfMounted(() => {
      setTeamDailyLoading(true)
      setTeamDailyError(null)
    })

    try {
      const response = await fetch("/api/admin/settings/team-daily-profit-percent", { cache: "no-store" })
      const payload = await readJsonSafe<{
        teamDailyProfitPercent?: number | null
        bounds?: { min: number; max: number }
        error?: unknown
      }>(response)

      if (!response.ok) {
        const message = typeof payload?.error === "string" ? payload.error : "Unable to load team daily profit percent"
        throw new Error(message)
      }

      const nextPercent =
        typeof payload?.teamDailyProfitPercent === "number" && Number.isFinite(payload.teamDailyProfitPercent)
          ? payload.teamDailyProfitPercent
          : null

      const nextBounds =
        payload?.bounds && typeof payload.bounds.min === "number" && typeof payload.bounds.max === "number"
          ? payload.bounds
          : null

      runIfMounted(() => {
        setTeamDailyProfitPercent(nextPercent)
        setTeamDailyDraft(nextPercent !== null ? nextPercent.toFixed(2) : "")
        if (nextBounds) {
          setTeamDailyBounds(nextBounds)
        }
      })
    } catch (error) {
      console.error(error)
      runIfMounted(() =>
        setTeamDailyError(
          error instanceof Error ? error.message : "Unable to load team daily profit percent",
        ),
      )
    } finally {
      runIfMounted(() => setTeamDailyLoading(false))
    }
  }, [runIfMounted])

  const handleTeamDailyProfitRefresh = useCallback(() => {
    fetchTeamDailyProfitSettings().catch(() => null)
  }, [fetchTeamDailyProfitSettings])

  const handleSaveTeamDailyProfitPercent = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      runIfMounted(() => {
        setTeamDailySaving(true)
        setTeamDailyError(null)
      })

      try {
        const body = teamDailyDraft.trim() === "" ? { percent: null } : { percent: teamDailyDraft }
        const response = await fetch("/api/admin/settings/team-daily-profit-percent", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })

        const payload = await readJsonSafe<{
          teamDailyProfitPercent?: number | null
          bounds?: { min: number; max: number }
          error?: unknown
        }>(response)

        if (!response.ok) {
          const message =
            typeof payload?.error === "string" ? payload.error : "Unable to update team daily profit percent"
          throw new Error(message)
        }

        const updatedPercent =
          typeof payload?.teamDailyProfitPercent === "number" && Number.isFinite(payload.teamDailyProfitPercent)
            ? payload.teamDailyProfitPercent
            : null

        const nextBounds =
          payload?.bounds && typeof payload.bounds.min === "number" && typeof payload.bounds.max === "number"
            ? payload.bounds
            : null

        runIfMounted(() => {
          setTeamDailyProfitPercent(updatedPercent)
          setTeamDailyDraft(updatedPercent !== null ? updatedPercent.toFixed(2) : "")
          if (nextBounds) {
            setTeamDailyBounds(nextBounds)
          }
        })

        toast({ description: updatedPercent === null ? "Team daily profit override disabled (using level defaults)." : `Team daily profit percent set to ${updatedPercent.toFixed(2)}%.` })
      } catch (error) {
        console.error(error)
        runIfMounted(() =>
          setTeamDailyError(
            error instanceof Error ? error.message : "Unable to update team daily profit percent",
          ),
        )
      } finally {
        runIfMounted(() => setTeamDailySaving(false))
      }
    },
    [runIfMounted, teamDailyDraft, toast],
  )

  const fetchLuckyRound = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/lucky-draw/round", { cache: "no-store" })
      const payload = await readJsonSafe<{ round?: LuckyDrawRound; error?: unknown }>(response)

      if (!response.ok) {
        const message = typeof payload?.error === "string" ? payload.error : "Unable to load lucky draw round"
        throw new Error(message)
      }

      if (!payload?.round) {
        throw new Error("Received an invalid response while loading the lucky draw round")
      }

      runIfMounted(() => {
        setLuckyRound(payload.round)
        if (!payload.round.selectedWinner && announceTimeoutRef.current) {
          clearTimeout(announceTimeoutRef.current)
          announceTimeoutRef.current = null
        }
        setPendingAnnouncement(
          payload.round.selectedWinner
            ? {
                id: payload.round.selectedWinner.depositId ?? "",
                winner: payload.round.selectedWinner.name,
                announcementAt: payload.round.announcementAtUtc ?? payload.round.endAtUtc,
                prizeUsd: payload.round.prizePoolUsd,
              }
            : null,
        )
      })
    } catch (error) {
      console.error("Failed to load lucky draw round", error)
      const message = error instanceof Error ? error.message : "Unable to load lucky draw round"
      toast({ variant: "destructive", description: message })
    }
  }, [runIfMounted, toast])

  const handleAnnounceWinner = useCallback(
    async (depositId: string) => {
      const winnerDeposit = luckyDeposits.find((deposit) => deposit.id === depositId && deposit.status === "APPROVED")
      if (!winnerDeposit) {
        toast({ variant: "destructive", description: "Select an accepted deposit before announcing a winner." })
        return
      }

      runIfMounted(() => setAnnouncingWinner(true))
      if (announceTimeoutRef.current) {
        clearTimeout(announceTimeoutRef.current)
      }

      try {
        const response = await fetch("/api/admin/lucky-draw/round", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ depositId }),
        })
        const payload = await readJsonSafe<{ round?: LuckyDrawRound; error?: unknown }>(response)

        if (!response.ok) {
          const message = typeof payload?.error === "string" ? payload.error : "Unable to schedule winner"
          throw new Error(message)
        }

        if (!payload?.round) {
          throw new Error("Received an invalid response while scheduling the winner")
        }

        const nextRound = payload.round
        const winnerName = nextRound.selectedWinner?.name ?? winnerDeposit.userName ?? "Participant"
        const announcementIso = nextRound.announcementAtUtc ?? nextRound.endAtUtc
        const prizeUsd = nextRound.prizePoolUsd

        runIfMounted(() => {
          setLuckyRound(nextRound)
          setPendingAnnouncement(
            nextRound.selectedWinner
              ? {
                  id: nextRound.selectedWinner.depositId ?? depositId,
                  winner: winnerName,
                  announcementAt: announcementIso,
                  prizeUsd,
                }
              : null,
          )
        })

        const announcementDate = announcementIso ? new Date(announcementIso) : null
        if (announcementDate) {
          const delay = Math.max(0, announcementDate.getTime() - Date.now())
          const safeDelay = Math.min(delay, 2_147_483_647)
          announceTimeoutRef.current = setTimeout(() => {
            if (!isMountedRef.current) {
              return
            }
            const announcementTime = new Date().toISOString()
            runIfMounted(() =>
              setLuckyRound((prev) => ({
                ...prev,
                lastWinner: {
                  name: winnerName,
                  announcedAt: announcementTime,
                },
                selectedWinner: null,
              })),
            )
            runIfMounted(() =>
              setRoundHistory((prev) => [
                {
                  id: `history-${announcementTime}`,
                  winner: winnerName,
                  announcedAt: announcementTime,
                  prizeUsd,
                },
                ...prev,
              ]),
            )
            runIfMounted(() => setPendingAnnouncement(null))
            toast({
              description: `${winnerName} has been announced as the Blind Box winner. $${prizeUsd.toFixed(2)} credited automatically.`,
            })
            announceTimeoutRef.current = null
          }, safeDelay)
        } else {
          announceTimeoutRef.current = null
        }

        toast({
          description: announcementDate
            ? `${winnerName} selected for the Blind Box prize. Official announcement on ${format(
                announcementDate,
                "MMM d, yyyy • HH:mm 'UTC'",
              )}.`
            : `${winnerName} selected for the Blind Box prize. Announcement timing will be shared soon.`,
        })
      } catch (error) {
        console.error(error)
        toast({
          variant: "destructive",
          description: error instanceof Error ? error.message : "Unable to schedule winner. Please try again.",
        })
      } finally {
        runIfMounted(() => setAnnouncingWinner(false))
      }
    },
    [announceTimeoutRef, luckyDeposits, runIfMounted, toast],
  )

  useEffect(() => {
    runIfMounted(() =>
      setStats((prev) => ({
        ...prev,
        pendingLuckyDrawDeposits: luckyDeposits.filter((deposit) => deposit.status === "PENDING").length,
      })),
    )
  }, [luckyDeposits, runIfMounted])

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/stats", { cache: "no-store" })
      const payload = await readJsonSafe<StatsResponse>(response)

      if (!response.ok) {
        const message = typeof payload?.error === "string" ? payload.error : "Unable to load stats"
        throw new Error(message)
      }

      if (!payload) {
        throw new Error("Received an empty response while loading stats")
      }

      const normalized = normalizeAdminStats(payload.stats)
      if (Object.keys(normalized).length > 0) {
        runIfMounted(() => setStats((prev) => ({ ...prev, ...normalized })))
      }

      lastStatsErrorRef.current = null
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : "Unable to load stats"
      if (lastStatsErrorRef.current !== message) {
        toast({ variant: "destructive", description: message })
        lastStatsErrorRef.current = message
      }
    }
  }, [runIfMounted, toast])

  const fetchTransactions = useCallback(
    async (options: { reset?: boolean } = {}) => {
      if (transactionLoadingRef.current) return
      const isReset = options.reset ?? false
      transactionLoadingRef.current = true
      runIfMounted(() => {
        setTransactionLoading(true)
        setTransactionError(null)
      })

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
          runIfMounted(() => {
            setTransactionCursor(null)
            setTransactionHasMore(false)
            setTransactions([])
          })
        }
        const response = await fetch(`/api/admin/transactions?${params.toString()}`, { cache: "no-store" })
        const payload = await readJsonSafe<TransactionsResponse>(response)

        if (!response.ok) {
          const message = typeof payload?.error === "string" ? payload.error : "Unable to load transactions"
          throw new Error(message)
        }

        const nextCursorValue = typeof payload?.nextCursor === "string" && payload.nextCursor.length > 0 ? payload.nextCursor : null
        const transactionData = Array.isArray(payload?.data) ? payload.data : []

        if (!Array.isArray(payload?.data)) {
          console.warn("Unexpected transactions payload", payload)
          runIfMounted(() =>
            setTransactionError((current) => current ?? "Received an invalid response while loading transactions"),
          )
        }

        transactionCursorRef.current = nextCursorValue
        runIfMounted(() => {
          setTransactionCursor(nextCursorValue)
          setTransactionHasMore(Boolean(nextCursorValue) && transactionData.length > 0)
          setTransactions((prev) => (isReset ? transactionData : [...prev, ...transactionData]))
        })
      } catch (error) {
        console.error(error)
        runIfMounted(() =>
          setTransactionError(error instanceof Error ? error.message : "Unable to load transactions"),
        )
      } finally {
        transactionLoadingRef.current = false
        runIfMounted(() => setTransactionLoading(false))
      }
    },
    [runIfMounted, transactionFilters],
  )

  const fetchUsers = useCallback(
    async (options: { reset?: boolean } = {}) => {
      if (userLoadingRef.current) return
      const isReset = options.reset ?? false
      userLoadingRef.current = true
      runIfMounted(() => {
        setUserLoading(true)
        setUserError(null)
      })

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
          runIfMounted(() => {
            setUserCursor(null)
            setUserHasMore(false)
            setUsers([])
          })
        }
        const response = await fetch(`/api/admin/users?${params.toString()}`, { cache: "no-store" })
        const payload = await readJsonSafe<UsersResponse>(response)

        if (!response.ok) {
          const message = typeof payload?.error === "string" ? payload.error : "Unable to load users"
          throw new Error(message)
        }

        const nextCursorValue = typeof payload?.nextCursor === "string" && payload.nextCursor.length > 0 ? payload.nextCursor : null
        const userData = Array.isArray(payload?.data) ? payload.data : []

        if (!Array.isArray(payload?.data)) {
          console.warn("Unexpected users payload", payload)
          runIfMounted(() => setUserError((current) => current ?? "Received an invalid response while loading users"))
        }

        userCursorRef.current = nextCursorValue
        runIfMounted(() => {
          setUserCursor(nextCursorValue)
          setUserHasMore(Boolean(nextCursorValue) && userData.length > 0)
          setUsers((prev) => (isReset ? userData : [...prev, ...userData]))
        })
      } catch (error) {
        console.error(error)
        runIfMounted(() => setUserError(error instanceof Error ? error.message : "Unable to load users"))
      } finally {
        userLoadingRef.current = false
        runIfMounted(() => setUserLoading(false))
      }
    },
    [runIfMounted, userFilters],
  )

  useEffect(() => {
    fetchTransactions({ reset: true }).catch(() => null)
  }, [fetchTransactions])

  useEffect(() => {
    fetchUsers({ reset: true }).catch(() => null)
  }, [fetchUsers])

  useEffect(() => {
    fetchLuckyRound().catch(() => null)
  }, [fetchLuckyRound])

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          return null
        }
        return readJsonSafe<{ user?: Partial<AdminSessionUser> }>(response)
      })
      .then((payload) => {
        if (payload?.user) {
          runIfMounted(() => setUser((prev) => ({ ...prev, ...payload.user })))
        }
      })
      .catch((error) => {
        console.error("Failed to refresh admin session", error)
      })
  }, [runIfMounted])

  const refreshAll = useCallback(async () => {
    transactionCursorRef.current = null
    userCursorRef.current = null
    runIfMounted(() => {
      setTransactionCursor(null)
      setUserCursor(null)
    })
    await Promise.allSettled([
      fetchTransactions({ reset: true }),
      fetchUsers({ reset: true }),
      fetchStats(),
      fetchLuckyRound(),
      fetchDailyProfitSettings(),
    ])
  }, [fetchDailyProfitSettings, fetchLuckyRound, fetchStats, fetchTransactions, fetchUsers, runIfMounted])

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
      const payload = await readJsonSafe<{ error?: unknown }>(response)
      if (!response.ok) {
        const message = typeof payload?.error === "string" ? payload.error : "Failed to queue export"
        throw new Error(message)
      }
      if (typeof window !== "undefined") {
        window.alert("Export queued. You will receive an email when it is ready.")
      } else {
        toast({ description: "Export queued. You will receive an email when it is ready." })
      }
    } catch (error) {
      console.error(error)
      runIfMounted(() =>
        setTransactionError(error instanceof Error ? error.message : "Unable to queue export"),
      )
    }
  }, [runIfMounted, toast, transactionFilters])

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
            <StatCard label="Total users" value={stats.totalUsers} />
            <StatCard label="Active users" value={stats.activeUsers} />
            <StatCard label="Pending deposits" value={stats.pendingDeposits} />
            <StatCard label="Pending withdrawals" value={stats.pendingWithdrawals} />
            <StatCard label="Lucky draw pending" value={stats.pendingLuckyDrawDeposits} />
          </div>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Daily profit rate</CardTitle>
              <CardDescription>Adjust the platform-wide mining payout percentage.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveDailyProfitPercent} className="space-y-4">
                <div className="grid gap-2">
                  <label htmlFor="daily-profit-percent" className="text-sm font-medium">
                    Daily profit percent
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Input
                      id="daily-profit-percent"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min={dailyProfitBounds.min.toFixed(2)}
                      max={dailyProfitBounds.max.toFixed(2)}
                      value={dailyProfitDraft}
                      onChange={handleDailyProfitDraftChange}
                      aria-describedby="daily-profit-percent-help"
                      className="sm:max-w-[180px]"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" disabled={disableDailyProfitSave} className="gap-2">
                        {dailyProfitSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Saving
                          </>
                        ) : (
                          "Save"
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2"
                        onClick={handleDailyProfitRefresh}
                        disabled={dailyProfitLoading || dailyProfitSaving}
                      >
                        {dailyProfitLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        Refresh
                      </Button>
                    </div>
                  </div>
                </div>
                <div id="daily-profit-percent-help" className="space-y-1 text-sm text-muted-foreground">
                  <p>
                    Current rate: <span className="font-medium">{dailyProfitPercent.toFixed(2)}%</span> · Example: $100 →
                    ${savedDailyProfitExample.toFixed(2)}
                  </p>
                  <p>
                    Draft preview: $100 → ${dailyProfitDraftExample.toFixed(2)} (allowed range {dailyProfitBounds.min.toFixed(2)}%
                    –{dailyProfitBounds.max.toFixed(2)}%)
                  </p>
                </div>
                {dailyProfitError && <p className="text-sm text-destructive">{dailyProfitError}</p>}
              </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Team daily profit rate</CardTitle>
            <CardDescription>
              Optional override for daily team mining rewards. Leave empty to use level defaults (L1: 1%, L2: 1%, L3–5: 2%).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveTeamDailyProfitPercent} className="space-y-4">
              <div className="grid gap-2">
                <label htmlFor="team-daily-profit-percent" className="text-sm font-medium">
                  Team daily profit percent
                </label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Input
                    id="team-daily-profit-percent"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={teamDailyBounds.min.toFixed(2)}
                    max={teamDailyBounds.max.toFixed(2)}
                    value={teamDailyDraft}
                    onChange={handleTeamDailyDraftChange}
                    placeholder="e.g. 1.00"
                    aria-describedby="team-daily-profit-percent-help"
                    className="sm:max-w-[180px]"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={teamDailySaving} className="gap-2">
                      {teamDailySaving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving
                        </>
                      ) : (
                        "Save"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={handleTeamDailyProfitRefresh}
                      disabled={teamDailyLoading || teamDailySaving}
                    >
                      {teamDailyLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Refresh
                    </Button>
                  </div>
                </div>
              </div>
              <div id="team-daily-profit-percent-help" className="space-y-1 text-sm text-muted-foreground">
                <p>
                  Current override: {teamDailyProfitPercent === null ? <span className="font-medium">Disabled</span> : <span className="font-medium">{teamDailyProfitPercent.toFixed(2)}%</span>}
                </p>
                <p>
                  Draft preview: {teamDailyDraft ? `$100 → ${multiplyAmountByPercent(100, Number.parseFloat(teamDailyDraft)).toFixed(2)}` : "—"} (allowed range {teamDailyBounds.min.toFixed(2)}%–{teamDailyBounds.max.toFixed(2)}%)
                </p>
                <p>Clear the input to remove the override and fall back to level defaults.</p>
              </div>
              {teamDailyError && <p className="text-sm text-destructive">{teamDailyError}</p>}
            </form>
          </CardContent>
        </Card>

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
              pendingAnnouncement={pendingAnnouncement}
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

function StatCard({ label, value }: { label: string; value: unknown }) {
  const formattedValue = formatNumberWithFallback(value, "0")
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{formattedValue}</p>
      </CardContent>
    </Card>
  )
}
