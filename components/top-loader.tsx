"use client"

import { useEffect, useRef } from "react"

import Router from "next/router"

const MIN_PROGRESS = 0.08
const INCREMENT_INTERVAL = 300

export function TopLoader() {
  const activeRequests = useRef(0)
  const progress = useRef(0)
  const intervalRef = useRef<number | null>(null)
  const barRef = useRef<HTMLDivElement | null>(null)
  const originalFetch = useRef<typeof window.fetch | null>(null)

  useEffect(() => {
    barRef.current = document.getElementById("top-loader") as HTMLDivElement | null
  }, [])

  useEffect(() => {
    const set = (value: number) => {
      progress.current = Math.max(0, Math.min(1, value))
      barRef.current?.style.setProperty("transform", `scaleX(${progress.current})`)
    }

    const start = () => {
      if (activeRequests.current === 0) {
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
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        set(1)
        window.setTimeout(() => {
          set(0)
        }, 220)
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

      if (originalFetch.current) {
        window.fetch = originalFetch.current
        originalFetch.current = null
      }
    }
  }, [])

  return null
}
