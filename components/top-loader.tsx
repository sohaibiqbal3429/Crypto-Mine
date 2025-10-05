"use client"

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"

type TopLoaderContextValue = {
  startTask: () => void
  stopTask: () => void
  withLoader: <T>(task: () => Promise<T>) => Promise<T>
}

const TopLoaderContext = createContext<TopLoaderContextValue | null>(null)

function usePrefersReducedMotion() {
  const query = "(prefers-reduced-motion: reduce)"
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return

    const mediaQuery = window.matchMedia(query)
    setPrefersReducedMotion(mediaQuery.matches)

    const updatePreference = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches)
    }

    mediaQuery.addEventListener("change", updatePreference)

    return () => {
      mediaQuery.removeEventListener("change", updatePreference)
    }
  }, [])

  return prefersReducedMotion
}

export function useTopLoader() {
  const context = useContext(TopLoaderContext)

  if (!context) {
    throw new Error("useTopLoader must be used within a TopLoaderProvider")
  }

  return context
}

export function TopLoaderProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const prefersReducedMotion = usePrefersReducedMotion()

  const [isVisible, setIsVisible] = useState(false)
  const [progress, setProgress] = useState(0)

  const activeTaskCount = useRef(0)
  const rafId = useRef<number | null>(null)
  const hideTimeoutId = useRef<number | null>(null)
  const initialRenderRef = useRef(true)
  const latestLocationKey = useRef<string>()

  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutId.current !== null) {
      window.clearTimeout(hideTimeoutId.current)
      hideTimeoutId.current = null
    }
  }, [])

  const stopAnimation = useCallback(() => {
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current)
      rafId.current = null
    }
  }, [])

  const beginAnimation = useCallback(() => {
    if (prefersReducedMotion) return

    stopAnimation()
    const step = () => {
      setProgress((previous) => {
        if (previous >= 0.92) return previous
        const increment = Math.max(0.01, (1 - previous) * 0.08)
        return Math.min(previous + increment, 0.92)
      })
      rafId.current = requestAnimationFrame(step)
    }
    rafId.current = requestAnimationFrame(step)
  }, [prefersReducedMotion, stopAnimation])

  const completeAnimation = useCallback(() => {
    stopAnimation()
    setProgress(1)

    clearHideTimeout()
    hideTimeoutId.current = window.setTimeout(() => {
      setIsVisible(false)
      setProgress(0)
      hideTimeoutId.current = null
    }, prefersReducedMotion ? 0 : 240) as unknown as number
  }, [clearHideTimeout, prefersReducedMotion, stopAnimation])

  const startTask = useCallback(() => {
    activeTaskCount.current += 1

    if (activeTaskCount.current === 1) {
      clearHideTimeout()
      setIsVisible(true)
      setProgress(prefersReducedMotion ? 1 : 0.05)
      beginAnimation()
    }
  }, [beginAnimation, clearHideTimeout, prefersReducedMotion])

  const stopTask = useCallback(() => {
    if (activeTaskCount.current === 0) return

    activeTaskCount.current -= 1

    if (activeTaskCount.current === 0) {
      completeAnimation()
    }
  }, [completeAnimation])

  const withLoader = useCallback(
    async <T,>(task: () => Promise<T>) => {
      startTask()
      try {
        return await task()
      } finally {
        stopTask()
      }
    },
    [startTask, stopTask],
  )

  const locationKey = useMemo(() => {
    const params = searchParams?.toString()
    return `${pathname ?? ""}?${params ?? ""}`
  }, [pathname, searchParams])

  useEffect(() => {
    if (initialRenderRef.current) {
      initialRenderRef.current = false
      latestLocationKey.current = locationKey
      return
    }

    if (latestLocationKey.current !== locationKey) {
      latestLocationKey.current = locationKey
      stopTask()
    }
  }, [locationKey, stopTask])

  useEffect(() => {
    const routerWithInternals = router as unknown as {
      [key: string]: unknown
      __topLoaderPatched?: boolean
    }

    if (!routerWithInternals || routerWithInternals.__topLoaderPatched) {
      return
    }

    const methodsToPatch = ["push", "replace", "back", "forward", "refresh"] as const
    const originals: Partial<Record<(typeof methodsToPatch)[number], unknown>> = {}

    methodsToPatch.forEach((method) => {
      const original = routerWithInternals[method]
      if (typeof original !== "function") return

      originals[method] = original
      routerWithInternals[method] = (...args: unknown[]) => {
        startTask()
        try {
          const result = (original as (...inner: unknown[]) => unknown).apply(router, args)
          if (result && typeof (result as Promise<unknown>).catch === "function") {
            return (result as Promise<unknown>).catch((error) => {
              stopTask()
              throw error
            })
          }
          return result
        } catch (error) {
          stopTask()
          throw error
        }
      }
    })

    routerWithInternals.__topLoaderPatched = true

    return () => {
      methodsToPatch.forEach((method) => {
        if (originals[method]) {
          routerWithInternals[method] = originals[method]
        }
      })
      routerWithInternals.__topLoaderPatched = false
    }
  }, [router, startTask, stopTask])

  useEffect(() => {
    return () => {
      stopAnimation()
      clearHideTimeout()
    }
  }, [clearHideTimeout, stopAnimation])

  const displayProgress = prefersReducedMotion ? (isVisible ? 1 : 0) : progress

  const contextValue = useMemo<TopLoaderContextValue>(
    () => ({ startTask, stopTask, withLoader }),
    [startTask, stopTask, withLoader],
  )

  return (
    <TopLoaderContext.Provider value={contextValue}>
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none fixed left-0 right-0 top-0 z-[9999] h-1 origin-left bg-gradient-to-r from-primary via-accent to-primary/80",
          prefersReducedMotion
            ? "transition-none"
            : "motion-safe:transition-[transform,opacity] motion-safe:duration-200 motion-safe:ease-out",
          isVisible ? "opacity-100" : "opacity-0",
        )}
        style={{ transform: `scaleX(${displayProgress})` }}
      />
      {children}
    </TopLoaderContext.Provider>
  )
}

export const TopLoader = TopLoaderProvider
