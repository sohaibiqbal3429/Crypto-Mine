"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { AlertCircle, Clock, Coins, Loader2, Sparkles, Zap } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface MiningWidgetProps {
  mining: {
    canMine: boolean
    nextEligibleAt: string
    earnedInCycle: number
    requiresDeposit?: boolean
    minDeposit?: number
  }
  onMiningSuccess?: () => void
  className?: string
}

export function MiningWidget({ mining, onMiningSuccess, className }: MiningWidgetProps) {
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({})
  const router = useRouter()
  const [canMine, setCanMine] = useState(mining.canMine)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [polling, setPolling] = useState<{
    key: string
    url: string
  } | null>(null)
  const [celebrating, setCelebrating] = useState(false)
  const lastClickRef = useRef<number>(0)
  const CLICK_DEBOUNCE_MS = 400

  const formatTimeUntilNext = () => {
    if (!mining.nextEligibleAt) return "Ready to mine!"
    const now = new Date()
    const nextTime = new Date(mining.nextEligibleAt)
    const diff = nextTime.getTime() - now.getTime()

    if (diff <= 0) return "Ready to mine!"

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`
  }

  const [nextWindowDisplay, setNextWindowDisplay] = useState(() => formatTimeUntilNext())

  useEffect(() => {
    setCanMine(mining.canMine)
  }, [mining.canMine])

  const triggerCelebration = useCallback(() => {
    setCelebrating(true)
    setTimeout(() => setCelebrating(false), 2000)
  }, [])

  const handleMining = useCallback(async () => {
    const now = Date.now()
    if (now - lastClickRef.current < CLICK_DEBOUNCE_MS) {
      setFeedback({ error: "Easy there! Please wait a moment before trying again." })
      return
    }

    lastClickRef.current = now

    if (!canMine) {
      setFeedback({ error: "Mining is not available right now." })
      return
    }

    if (isSubmitting || polling) {
      setFeedback({ error: "We are already processing a mining request." })
      return
    }

    try {
      setFeedback({})
      setIsSubmitting(true)
      const idempotencyKey = crypto.randomUUID()
      const response = await fetch("/api/mining/click", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
      })

      const data = await response.json().catch(() => ({}))

      if (response.status === 200) {
        const result = data?.status?.result
        const profit = typeof result?.profit === "number" ? result.profit : undefined
        setFeedback({
          success:
            result?.message ??
            (profit !== undefined ? `Mining successful! Earned $${profit.toFixed(2)}` : "Mining successful!"),
        })
        setCanMine(false)
        setPolling(null)
        triggerCelebration()
        router.refresh()
        onMiningSuccess?.()
        return
      }

      if (response.status === 202) {
        setFeedback({ success: "Mining request queued. We'll update you shortly." })
        setPolling({ key: idempotencyKey, url: data?.statusUrl })
        return
      }

      if (response.status === 429 || response.status === 503) {
        const retry = response.headers.get("Retry-After")
        const backoff = response.headers.get("X-Backoff-Hint")
        const retryMessage = retry ? ` Try again in ${retry} seconds.` : ""
        const backoffMessage = backoff ? ` Recommended backoff: ${backoff}s.` : ""
        setFeedback({
          error: `${data?.error ?? "System temporarily busy."}${retryMessage}${backoffMessage}`,
        })
        return
      }

      setFeedback({ error: data?.error ?? "Unable to start mining. Please try again." })
    } catch (error) {
      console.error("Mining request failed", error)
      setFeedback({ error: "Unable to reach the mining service. Please try again." })
    } finally {
      setIsSubmitting(false)
    }
  }, [canMine, isSubmitting, polling, router, onMiningSuccess, triggerCelebration])

  useEffect(() => {
    const updateCountdown = () => {
      const display = formatTimeUntilNext()
      setNextWindowDisplay(display)
      return display
    }

    const initialDisplay = updateCountdown()

    if (initialDisplay === "Ready to mine!" || canMine) {
      return
    }

    const interval = setInterval(() => {
      const currentDisplay = updateCountdown()
      if (currentDisplay === "Ready to mine!") {
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [canMine, mining.nextEligibleAt])

  useEffect(() => {
    if (!polling?.url) {
      return
    }

    let cancelled = false

    const poll = async () => {
      try {
        const response = await fetch(polling.url, { cache: "no-store" })
        const data = await response.json().catch(() => ({}))
        if (cancelled) {
          return
        }

        if (response.status === 200) {
          const result = data?.status?.result
          const profit = typeof result?.profit === "number" ? result.profit : undefined
          setFeedback({
            success:
              result?.message ??
              (profit !== undefined ? `Mining successful! Earned $${profit.toFixed(2)}` : "Mining successful!"),
          })
          setCanMine(false)
          setPolling(null)
          triggerCelebration()
          router.refresh()
          onMiningSuccess?.()
          return
        }

        if (response.status === 202) {
          const queueDepth = response.headers.get("X-Queue-Depth")
          const status = data?.status?.status
          const message =
            status === "processing"
              ? "Mining request is processing..."
              : queueDepth
                ? `Mining queued. Position ~${queueDepth}.`
                : "Mining request queued..."
          setFeedback({ success: message })
          return
        }

        if (response.status === 429 || response.status === 503) {
          const retry = response.headers.get("Retry-After")
          const backoff = response.headers.get("X-Backoff-Hint")
          const retryMessage = retry ? ` Try again in ${retry} seconds.` : ""
          const backoffMessage = backoff ? ` Recommended backoff: ${backoff}s.` : ""
          setFeedback({
            error: `${data?.error ?? "System temporarily busy."}${retryMessage}${backoffMessage}`,
          })
          setPolling(null)
          return
        }

        setFeedback({ error: data?.error ?? "Unable to complete mining. Please try again." })
        setPolling(null)
      } catch (error) {
        if (cancelled) {
          return
        }
        console.error("Polling failed", error)
        setFeedback({ error: "Unable to reach the mining queue. Please try again." })
        setPolling(null)
      }
    }

    poll()

    return () => {
      cancelled = true
    }
  }, [polling, router, onMiningSuccess, triggerCelebration])

  const isMiningBusy = isSubmitting || Boolean(polling)

  const miningState = useMemo(() => {
    if (canMine) {
      return { label: "Available", icon: <Zap className="h-4 w-4" aria-hidden /> }
    }
    if (mining.requiresDeposit) {
      return { label: "Deposit required", icon: <AlertCircle className="h-4 w-4" aria-hidden /> }
    }
    return { label: "Cooldown", icon: <Clock className="h-4 w-4" aria-hidden /> }
  }, [canMine, mining.requiresDeposit])

  const cooldownProgress = useMemo(() => {
    if (canMine) return 1
    const now = Date.now()
    const nextTime = new Date(mining.nextEligibleAt).getTime()
    const diff = Math.max(nextTime - now, 0)
    const fallbackWindow = 3 * 60 * 60 * 1000 // 3 hours visual window
    const windowMs = Math.max(diff, fallbackWindow)
    const progress = 1 - diff / windowMs
    return Number.isFinite(progress) ? Math.max(0.05, Math.min(progress, 0.95)) : 0.1
  }, [canMine, mining.nextEligibleAt, nextWindowDisplay])

  return (
    <Card
      className={cn(
        "relative overflow-hidden rounded-[32px] border border-white/30 bg-white/80 px-6 py-6 text-foreground shadow-[0_25px_60px_rgba(87,65,217,0.2)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:text-white",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.45),_transparent_55%)]" aria-hidden />
      <CardContent className="relative px-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Pulse reactor</p>
            <p className="text-2xl font-semibold">Mint-Coin fusion chamber</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/40 bg-white/70 px-4 py-2 text-sm font-semibold text-foreground shadow-inner dark:border-white/10 dark:bg-white/10 dark:text-white">
            <Sparkles className="h-4 w-4" aria-hidden />
            Cycle yield {mining.earnedInCycle > 0 ? `+$${mining.earnedInCycle.toFixed(2)}` : "—"}
          </div>
        </div>

        {feedback.error ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-100">
            {feedback.error}
          </div>
        ) : null}

        {feedback.success ? (
          <div className="mt-6 rounded-2xl border border-emerald-300 bg-emerald-50/80 p-4 text-sm text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-100">
            {feedback.success}
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <div
                className="pointer-events-none absolute inset-2 rounded-full border-4 border-white/40"
                style={{
                  background: `conic-gradient(from 90deg, rgba(124,58,237,0.9) ${cooldownProgress * 360}deg, rgba(255,255,255,0.15) ${cooldownProgress * 360}deg)`,
                }}
              />
              <motion.button
                type="button"
                onClick={() => {
                  if (!canMine || isMiningBusy || mining.requiresDeposit) return
                  void handleMining()
                }}
                disabled={!canMine || isMiningBusy || Boolean(mining.requiresDeposit)}
                whileTap={{ scale: canMine ? 0.94 : 1 }}
                animate={{ scale: canMine ? [1, 1.05, 1] : 1 }}
                transition={{ repeat: canMine ? Infinity : 0, duration: 2, ease: "easeInOut" }}
                aria-label="Trigger mining cycle"
                className={cn(
                  "relative flex h-56 w-56 items-center justify-center rounded-full text-center text-white",
                  "bg-gradient-to-br from-purple-500 via-indigo-500 to-cyan-400 shadow-[0_30px_70px_rgba(79,70,229,0.45)]",
                  !canMine || isMiningBusy || mining.requiresDeposit
                    ? "opacity-60 saturate-50"
                    : "hover:scale-[1.01]",
                )}
              >
                {celebrating && (
                  <div className="pointer-events-none absolute inset-0">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <motion.span
                        key={index}
                        className="absolute h-2 w-2 rounded-full bg-white/80"
                        initial={{ opacity: 1, scale: 0.6, x: 0, y: 0 }}
                        animate={{
                          opacity: 0,
                          scale: 1.4,
                          x: Math.cos((index / 8) * Math.PI * 2) * 80,
                          y: Math.sin((index / 8) * Math.PI * 2) * 80,
                        }}
                        transition={{ duration: 1.2 }}
                      />
                    ))}
                  </div>
                )}
                {isMiningBusy ? (
                  <Loader2 className="h-12 w-12 animate-spin" aria-hidden />
                ) : (
                  <Coins className="h-16 w-16" aria-hidden />
                )}
                <span className="mt-3 block text-lg font-semibold">{canMine ? "Tap to mine" : "Stand by"}</span>
              </motion.button>
              <div className="absolute inset-0 animate-pulse rounded-full bg-white/10" aria-hidden />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 text-sm uppercase tracking-[0.3em]">
              <span className="flex items-center gap-2 rounded-full border border-white/40 px-4 py-1 text-foreground dark:border-white/10 dark:text-white">
                {miningState.icon}
                {miningState.label}
              </span>
              <span className="rounded-full border border-white/40 px-4 py-1 text-foreground dark:border-white/10 dark:text-white">
                Next window {nextWindowDisplay}
              </span>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/40 bg-white/70 p-5 shadow-inner dark:border-white/10 dark:bg-white/5">
            <div className="space-y-4 text-sm text-foreground/80 dark:text-white/80">
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-[0.3em] text-muted-foreground">Status</span>
                <span className="font-semibold">
                  {canMine ? "Available" : mining.requiresDeposit ? "Deposit needed" : "Cooling down"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-[0.3em] text-muted-foreground">Queue</span>
                <span className="font-semibold">{polling ? "Processing" : "Realtime"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-[0.3em] text-muted-foreground">Window</span>
                <span className="font-semibold">{nextWindowDisplay}</span>
              </div>
              {mining.requiresDeposit ? (
                <div className="rounded-2xl border border-dashed border-white/60 bg-white/40 p-4 text-sm text-foreground dark:border-white/20 dark:bg-white/10">
                  <p className="font-semibold">Deposit at least ${mining.minDeposit?.toFixed(0) ?? 30} USDT to unlock the rig.</p>
                  <Button asChild className="mt-3 w-full rounded-2xl bg-gradient-to-r from-purple-500 to-cyan-400 text-white shadow-lg">
                    <Link href="/wallet/deposit">Make a deposit</Link>
                  </Button>
                </div>
              ) : null}
            </div>

            {mining.earnedInCycle > 0 && (
              <div className="mt-6 rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-100/80 to-cyan-100/60 p-4 text-emerald-700 dark:border-emerald-500/40 dark:from-emerald-900/40 dark:to-cyan-900/30 dark:text-emerald-100">
                <p className="text-xs uppercase tracking-[0.4em]">Last cycle</p>
                <p className="mt-2 text-3xl font-bold">+${mining.earnedInCycle.toFixed(2)}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-200">Credited instantly to balance</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
