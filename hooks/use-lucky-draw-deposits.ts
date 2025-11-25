"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { LuckyDrawDepositStatus, LuckyDrawDeposit } from "@/lib/types/lucky-draw"

type Scope = "user" | "admin"

interface UseLuckyDrawDepositsOptions {
  scope?: Scope
  autoRefresh?: boolean
  refreshIntervalMs?: number
}

const DEFAULT_REFRESH_INTERVAL = 30_000

function resolveEndpoint(scope: Scope): string {
  return scope === "admin" ? "/api/admin/lucky-draw/deposits" : "/api/dashboard/lucky-draw-deposits"
}

function parseError(response: Response, fallback: string): Promise<Error> {
  return response
    .json()
    .catch(() => null)
    .then((data) => {
      const message = (data?.error || data?.message || fallback) as string
      return new Error(message)
    })
}

export function useLuckyDrawDeposits({
  scope = "user",
  autoRefresh = scope === "user",
  refreshIntervalMs = DEFAULT_REFRESH_INTERVAL,
}: UseLuckyDrawDepositsOptions = {}) {
  const [deposits, setDeposits] = useState<LuckyDrawDeposit[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const endpoint = useMemo(() => resolveEndpoint(scope), [scope])
  const abortControllerRef = useRef<AbortController | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchDeposits = useCallback(async () => {
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal })
      if (!response.ok) {
        throw await parseError(response, "Unable to load deposits")
      }

      const payload = await response.json()
      const nextDeposits = Array.isArray(payload.deposits) ? (payload.deposits as LuckyDrawDeposit[]) : []
      setDeposits(nextDeposits)
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return
      }
      console.error("Lucky draw deposits fetch error", error)
      setError(error instanceof Error ? error.message : "Unable to load deposits")
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  useEffect(() => {
    fetchDeposits()
    return () => {
      abortControllerRef.current?.abort()
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }
    }
  }, [fetchDeposits])

  useEffect(() => {
    if (!autoRefresh) {
      return
    }

    const schedule = () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }
      refreshTimerRef.current = setTimeout(async () => {
        await fetchDeposits()
        schedule()
      }, refreshIntervalMs)
    }

    schedule()

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }
    }
  }, [autoRefresh, fetchDeposits, refreshIntervalMs])

  const updateDepositStatus = useCallback(
    async (depositId: string, nextStatus: LuckyDrawDepositStatus, note?: string) => {
      if (scope !== "admin") {
        return false
      }

      if (nextStatus === "PENDING") {
        return false
      }

      const isApproving = nextStatus === "APPROVED"
      const endpoint = isApproving
        ? `/api/admin/lucky-draw/deposits/${depositId}/approve`
        : `/api/admin/lucky-draw/deposits/${depositId}/reject`

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        ...(isApproving ? {} : { body: JSON.stringify({ note: note ?? "" }) }),
      })

      if (!response.ok) {
        throw await parseError(response, isApproving ? "Unable to approve deposit" : "Unable to reject deposit")
      }

      const payload = await response.json().catch(() => null)
      const updatedDeposit: LuckyDrawDeposit | undefined = payload?.deposit

      setDeposits((current) => {
        if (!updatedDeposit) {
          return current.map((deposit) =>
            deposit.id === depositId
              ? {
                  ...deposit,
                  status: nextStatus,
                  adminNote: note ?? deposit.adminNote,
                }
              : deposit,
          )
        }

        return current.map((deposit) => (deposit.id === depositId ? updatedDeposit : deposit))
      })

      return true
    },
    [scope],
  )

  const refresh = useCallback(async () => {
    await fetchDeposits()
  }, [fetchDeposits])

  return { deposits, loading, error, updateDepositStatus, refresh }
}
