"use client"

import { useCallback, useEffect, useState } from "react"

import type { DepositStatus, LuckyDrawDeposit } from "@/lib/types/lucky-draw"

const STORAGE_KEY = "crypto-mine:lucky-draw-deposits"
const BROADCAST_EVENT = "lucky-draw-deposits:update"

function createDefaultDeposits(): LuckyDrawDeposit[] {
  const now = Date.now()
  return [
    {
      id: "demo-ava-sterling",
      txHash: "0x9f5a9c238be02f4b912cd34afc0d8773e4f2abc17f8c1e2d3f4a5b6c7d8e9f01",
      receiptReference: "https://bscscan.com/tx/0x9f5a9c238be02f4b912cd34afc0d8773e4f2abc17f8c1e2d3f4a5b6c7d8e9f01",
      submittedAt: new Date(now - 60 * 60 * 1000).toISOString(),
      status: "PENDING",
      userName: "Ava Sterling",
      userEmail: "ava@example.com",
      roundId: "demo-round",
    },
    {
      id: "demo-noah-quinn",
      txHash: "0xa3b8c9d0e1f234567890abcdef1234567890abcdef1234567890abcdef123456",
      receiptReference: "receipt-noah.pdf",
      submittedAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
      status: "ACCEPTED",
      userName: "Noah Quinn",
      userEmail: "noah@example.com",
      roundId: "demo-round",
    },
    {
      id: "demo-mia-rivers",
      txHash: "0xf45d67e89abc0123456789defabcdef0123456789abcdef0123456789abcdef0",
      receiptReference: "https://bscscan.com/tx/0xf45d67e89abc0123456789defabcdef0123456789abcdef0123456789abcdef0",
      submittedAt: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
      status: "REJECTED",
      userName: "Mia Rivers",
      userEmail: "mia@example.com",
      roundId: "demo-round",
    },
  ]
}

function readDepositsFromStorage(): LuckyDrawDeposit[] | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as LuckyDrawDeposit[]
    if (!Array.isArray(parsed)) {
      return null
    }

    return parsed
  } catch (error) {
    console.error("Failed to read lucky draw deposits from storage", error)
    return null
  }
}

function persistDepositsToStorage(deposits: LuckyDrawDeposit[]) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(deposits))
  window.dispatchEvent(new CustomEvent<LuckyDrawDeposit[]>(BROADCAST_EVENT, { detail: deposits }))
}

export function useLuckyDrawDeposits() {
  const [deposits, setDeposits] = useState<LuckyDrawDeposit[]>(() => {
    const stored = readDepositsFromStorage()
    if (stored) {
      return stored
    }

    const defaults = createDefaultDeposits()
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults))
    }
    return defaults
  })

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) {
        return
      }

      if (!event.newValue) {
        setDeposits([])
        return
      }

      try {
        const parsed = JSON.parse(event.newValue) as LuckyDrawDeposit[]
        setDeposits(parsed)
      } catch (error) {
        console.error("Failed to parse lucky draw deposits from storage event", error)
      }
    }

    const handleBroadcast = (event: Event) => {
      const customEvent = event as CustomEvent<LuckyDrawDeposit[]>
      const detail = customEvent.detail
      if (Array.isArray(detail)) {
        setDeposits(detail)
      }
    }

    window.addEventListener("storage", handleStorage)
    window.addEventListener(BROADCAST_EVENT, handleBroadcast as EventListener)

    return () => {
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener(BROADCAST_EVENT, handleBroadcast as EventListener)
    }
  }, [])

  const updateDeposits = useCallback(
    (updater: LuckyDrawDeposit[] | ((current: LuckyDrawDeposit[]) => LuckyDrawDeposit[])) => {
      setDeposits((current) => {
        const next = typeof updater === "function" ? (updater as (curr: LuckyDrawDeposit[]) => LuckyDrawDeposit[])(current) : updater
        persistDepositsToStorage(next)
        return next
      })
    },
    [],
  )

  const addDeposit = useCallback(
    (deposit: LuckyDrawDeposit) => {
      updateDeposits((current) => [deposit, ...current])
    },
    [updateDeposits],
  )

  const updateDepositStatus = useCallback(
    (depositId: string, nextStatus: DepositStatus) => {
      let changed = false
      updateDeposits((current) =>
        current.map((deposit) => {
          if (deposit.id !== depositId) {
            return deposit
          }

          if (deposit.status !== nextStatus) {
            changed = true
          }

          return { ...deposit, status: nextStatus }
        }),
      )
      return changed
    },
    [updateDeposits],
  )

  const replaceDeposits = useCallback(
    (nextDeposits: LuckyDrawDeposit[]) => {
      updateDeposits(nextDeposits)
    },
    [updateDeposits],
  )

  return { deposits, addDeposit, updateDepositStatus, replaceDeposits }
}
