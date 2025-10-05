"use client"

import { useEffect, useRef } from "react"

import Router from "next/router"

const MIN_PROGRESS = 0.08
const INCREMENT_INTERVAL = 300
const MIN_VISIBLE_DURATION = 400
const RESET_FADE_DURATION = 260

export function TopLoader() {
  const activeRequests = useRef(0)
  const progress = useRef(0)
  const intervalRef = useRef<number | null>(null)
  const barRef = useRef<HTMLDivElement | null>(null)
  const originalFetch = useRef<typeof window.fetch | null>(null)
  const settleTimeoutRef = useRef<number | null>(null)
  const fadeTimeoutRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)

  useEffect(() => {
    barRef.current = document.getElementById("top-loader") as HTMLDivElement | null
  }, [])

  useEffect(() => {
    const clearTimer = (ref: { current: number | null }) => {
      if (ref.current) {
        window.clearTimeout(ref.current)
        ref.current = null
      }
    }

    const set = (value: number) => {
      progress.current = Math.max(0, Math.min(1, value))
      barRef.current?.style.setProperty("transform", `scaleX(${progress.current})`)
    }

    const start = () => {
      clearTimer(settleTimeoutRef)
      clearTimer(fadeTimeoutRef)

      if (activeRequests.current === 0) {
        startTimeRef.current = performance.now()
        if (barRef.current) {
          barRef.current.style.visibility = "visible"
          barRef.current.style.opacity = "1"
        }
        set(MIN_PROGRESS)
        intervalRef.current = window.setInterval(() => {
          const next = progress.current + (1 - progress.current) * 0.1
          set(next)
        }, INCREMENT_INTERVAL) as unknown as number
      }
      activeRequests.current += 1
    }

    const done = () => {
      if (activeRequests.current === 0) return
      activeRequests.current -= 1
      if (activeRequests.current === 0) {
        const finalize = () => {
          if (intervalRef.current) {
            window.clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          set(1)

          if (barRef.current) {
            const currentBar = barRef.current
            requestAnimationFrame(() => {
              currentBar.style.opacity = "0"
            })
          }

          fadeTimeoutRef.current = window.setTimeout(() => {
            if (activeRequests.current > 0) return
            set(0)
            if (barRef.current) {
              barRef.current.style.visibility = "hidden"
            }
            fadeTimeoutRef.current = null
          }, RESET_FADE_DURATION)
        }

        const elapsed = performance.now() - startTimeRef.current
        if (elapsed < MIN_VISIBLE_DURATION) {
          settleTimeoutRef.current = window.setTimeout(() => {
            finalize()
            settleTimeoutRef.current = null
          }, MIN_VISIBLE_DURATION - elapsed)
        } else {
          finalize()
        }
      }
    }

    const handleStart = () => start()
    const handleDone = () => done()

    Router.events.on("routeChangeStart", handleStart)
    Router.events.on("routeChangeComplete", handleDone)
    Router.events.on("routeChangeError", handleDone)

    if (typeof window !== "undefined" && !originalFetch.current) {
      originalFetch.current = window.fetch
      window.fetch = async (...args) => {
        start()
        try {
          return await originalFetch.current!(...args)
        } finally {
          done()
        }
      }
    }

    return () => {
      Router.events.off("routeChangeStart", handleStart)
      Router.events.off("routeChangeComplete", handleDone)
      Router.events.off("routeChangeError", handleDone)

      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }

      clearTimer(settleTimeoutRef)
      clearTimer(fadeTimeoutRef)

      if (originalFetch.current) {
        window.fetch = originalFetch.current
        originalFetch.current = null
      }
    }
  }, [])

  return null
}
