"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

export type LaunchPhase = "scheduled" | "launching" | "live"

export interface CountdownSegment {
  unit: "days" | "hours" | "minutes" | "seconds"
  value: number
}

interface CountdownState {
  segments: CountdownSegment[]
  remainingMs: number
}

const SECOND_MS = 1000
const MINUTE_MS = 60 * SECOND_MS
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const RESYNC_INTERVAL_MS = 60 * SECOND_MS
const MAX_CLOCK_DRIFT_MS = 2000
const LAUNCH_EVENT = "LAUNCH_STARTED"

function calculateSegments(remainingMs: number): CountdownState {
  const clamped = Math.max(remainingMs, 0)
  const days = Math.floor(clamped / DAY_MS)
  const hours = Math.floor((clamped % DAY_MS) / HOUR_MS)
  const minutes = Math.floor((clamped % HOUR_MS) / MINUTE_MS)
  const seconds = Math.floor((clamped % MINUTE_MS) / SECOND_MS)

  return {
    segments: [
      { unit: "days", value: days },
      { unit: "hours", value: hours },
      { unit: "minutes", value: minutes },
      { unit: "seconds", value: seconds },
    ],
    remainingMs: clamped,
  }
}

interface LaunchCountdown {
  phase: LaunchPhase
  countdown: CountdownState | null
  launchAt: Date | null
  isReady: boolean
  refresh: () => void
}

export function useLaunchCountdown(): LaunchCountdown {
  const [phase, setPhase] = useState<LaunchPhase>("scheduled")
  const [countdown, setCountdown] = useState<CountdownState | null>(null)
  const [launchAt, setLaunchAt] = useState<Date | null>(null)
  const [isReady, setIsReady] = useState(false)

  const offsetRef = useRef(0)
  const intervalRef = useRef<number | null>(null)
  const resyncTimerRef = useRef<number | null>(null)
  const launchingTimeoutRef = useRef<number | null>(null)
  const hasDispatchedRef = useRef(false)
  const launchAtRef = useRef<Date | null>(null)

  const computeRemaining = useCallback(() => {
    const launchDate = launchAtRef.current
    if (!launchDate) return

    const now = Date.now()
    const currentServerTime = now - offsetRef.current
    const remaining = launchDate.getTime() - currentServerTime

    if (remaining <= 0) {
      setCountdown(calculateSegments(0))
      if (phase !== "live" && phase !== "launching") {
        setPhase("launching")
        if (launchingTimeoutRef.current) {
          window.clearTimeout(launchingTimeoutRef.current)
        }
        launchingTimeoutRef.current = window.setTimeout(() => {
          if (!hasDispatchedRef.current) {
            window.dispatchEvent(new CustomEvent(LAUNCH_EVENT))
            hasDispatchedRef.current = true
          }
          setPhase("live")
        }, 500)
      } else if (phase === "launching" && !hasDispatchedRef.current) {
        window.dispatchEvent(new CustomEvent(LAUNCH_EVENT))
        hasDispatchedRef.current = true
        setPhase("live")
      }
      return
    }

    hasDispatchedRef.current = false
    if (phase !== "scheduled") {
      setPhase("scheduled")
    }

    setCountdown(calculateSegments(remaining))
  }, [phase])

  const scheduleTick = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current)
    }

    computeRemaining()
    intervalRef.current = window.setInterval(computeRemaining, SECOND_MS) as unknown as number
  }, [computeRemaining])

  const clearTimers = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (resyncTimerRef.current) {
      window.clearInterval(resyncTimerRef.current)
      resyncTimerRef.current = null
    }
    if (launchingTimeoutRef.current) {
      window.clearTimeout(launchingTimeoutRef.current)
      launchingTimeoutRef.current = null
    }
  }, [])

  const hydrateFromPayload = useCallback((payload: { launch_at: string; server_now: string }) => {
    const launchDate = new Date(payload.launch_at)
    const serverNow = new Date(payload.server_now)

    if (Number.isNaN(launchDate.getTime()) || Number.isNaN(serverNow.getTime())) {
      return
    }

    launchAtRef.current = launchDate
    setLaunchAt(launchDate)
    offsetRef.current = Date.now() - serverNow.getTime()
    setCountdown(calculateSegments(launchDate.getTime() - serverNow.getTime()))
    setPhase(launchDate.getTime() <= serverNow.getTime() ? "live" : "scheduled")
    setIsReady(true)
    scheduleTick()
  }, [scheduleTick])

  const fetchSchedule = useCallback(async () => {
    try {
      const response = await fetch("/api/launch", { cache: "no-store" })
      if (!response.ok) return
      const data = (await response.json()) as { launch_at: string; server_now: string }
      hydrateFromPayload(data)
    } catch (error) {
      console.error("Failed to fetch launch schedule", error)
    }
  }, [hydrateFromPayload])

  useEffect(() => {
    fetchSchedule()

    return () => {
      clearTimers()
    }
  }, [fetchSchedule, clearTimers])

  useEffect(() => {
    if (!launchAt) return

    if (resyncTimerRef.current) {
      window.clearInterval(resyncTimerRef.current)
    }

    resyncTimerRef.current = window.setInterval(async () => {
      try {
        const response = await fetch("/api/launch", { cache: "no-store" })
        if (!response.ok) return
        const data = (await response.json()) as { launch_at: string; server_now: string }
        const newLaunchAt = new Date(data.launch_at)
        const newServerNow = new Date(data.server_now)
        if (Number.isNaN(newLaunchAt.getTime()) || Number.isNaN(newServerNow.getTime())) {
          return
        }

        const newOffset = Date.now() - newServerNow.getTime()
        const shouldResync = Math.abs(newOffset - offsetRef.current) > MAX_CLOCK_DRIFT_MS
        const launchChanged = launchAtRef.current?.getTime() !== newLaunchAt.getTime()

        if (shouldResync || launchChanged) {
          offsetRef.current = newOffset
          launchAtRef.current = newLaunchAt
          setLaunchAt(newLaunchAt)
          computeRemaining()
        }
      } catch (error) {
        console.error("Failed to resync launch schedule", error)
      }
    }, RESYNC_INTERVAL_MS) as unknown as number

    return () => {
      if (resyncTimerRef.current) {
        window.clearInterval(resyncTimerRef.current)
        resyncTimerRef.current = null
      }
    }
  }, [launchAt, computeRemaining])

  useEffect(() => {
    return () => {
      clearTimers()
    }
  }, [clearTimers])

  const countdownValue = useMemo(() => {
    if (!countdown) return null
    return countdown
  }, [countdown])

  return {
    phase,
    countdown: countdownValue,
    launchAt,
    isReady,
    refresh: fetchSchedule,
  }
}

export function formatCompactCountdown(segments: CountdownSegment[]): string {
  return segments
    .map(({ unit, value }) => {
      const symbol = unit === "days" ? "d" : unit === "hours" ? "h" : unit === "minutes" ? "m" : "s"
      return `${value.toString().padStart(2, "0")}${symbol}`
    })
    .join(" · ")
}

export { LAUNCH_EVENT }
