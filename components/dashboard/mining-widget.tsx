"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Zap, AlertCircle, Coins } from "lucide-react"
import { motion } from "framer-motion"

interface MiningWidgetProps {
  mining: {
    canMine: boolean
    nextEligibleAt: string
    earnedInCycle: number
    requiresDeposit?: boolean
    minDeposit?: number
  }
  onMiningSuccess?: () => void
}

export function MiningWidget({ mining, onMiningSuccess }: MiningWidgetProps) {
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({})
  const router = useRouter()
  const [canMine, setCanMine] = useState(mining.canMine)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [polling, setPolling] = useState<{
    key: string
    url: string
  } | null>(null)
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
  }, [canMine, isSubmitting, polling, router])

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
            error: `${data?.status?.error?.message ?? "System busy."}${retryMessage}${backoffMessage}`,
          })
        } else {
          setFeedback({ error: data?.status?.error?.message ?? "Mining request failed." })
        }
        setPolling(null)
      } catch (error) {
        if (cancelled) {
          return
        }
        console.error("Mining status poll failed", error)
        setFeedback({ error: "Lost connection while waiting for mining response." })
        setPolling(null)
      }
    }

    const interval = setInterval(poll, 1500)
    void poll()

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [polling, router])

  const isMiningBusy = isSubmitting || Boolean(polling)

  return (
    <Card className="col-span-full lg:col-span-2 rounded-xl border border-border/70 bg-card/70 shadow-[0_18px_38px_-26px_rgba(0,0,0,0.7)]">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary">
              <Coins className="h-5 w-5" aria-hidden />
            </div>
            Core Hashing Engine
          </CardTitle>
          <p className="text-sm text-muted-foreground">Status orchestration for 5G-grade mining lanes.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1 text-primary">
            {canMine ? "Active" : mining.requiresDeposit ? "Funding Needed" : "Cooling"}
          </Badge>
          <span className="rounded-md bg-secondary px-2 py-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{nextWindowDisplay}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {feedback.error && (
          <Alert variant="destructive" className="border-destructive/40 bg-destructive/10 text-destructive-foreground">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{feedback.error}</AlertDescription>
          </Alert>
        )}

        {feedback.success && (
          <Alert className="border-accent/40 bg-accent/10 text-accent-foreground">
            <Zap className="h-4 w-4" />
            <AlertDescription className="text-foreground">{feedback.success}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border/60 bg-secondary/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Next eligible window</p>
            <p className="mt-2 text-xl font-semibold text-foreground">{nextWindowDisplay}</p>
            <p className="mt-1 text-xs text-muted-foreground">Clock synced to network time</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Cycle earnings</p>
            <p className="mt-2 text-xl font-semibold text-foreground">${mining.earnedInCycle.toFixed(2)}</p>
            <div className="mt-3 h-1.5 rounded-full bg-background/60">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                initial={{ width: "10%" }}
                animate={{ width: canMine ? "80%" : "48%" }}
                transition={{ duration: 0.6 }}
              />
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Engine readiness</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-md border border-border/70 bg-background/60 text-center text-sm font-semibold leading-10 text-primary">
                {canMine ? "ON" : "PAUSE"}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Thermal</span>
                  <span>{canMine ? "Stable" : "Cooling"}</span>
                </div>
                <div className="h-1.5 rounded-full bg-background/60">
                  <div className="h-full w-[72%] rounded-full bg-primary" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-lg border border-border/60 bg-secondary/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Run scheduler</p>
            <div className="space-y-2">
              {["Signal check", "Hashing", "Verification", "Settlement"].map((stage, idx) => (
                <div key={stage} className="space-y-1">
                  <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                    <span>{stage}</span>
                    <span className="text-foreground/80">{idx < 2 ? "Queued" : "Ready"}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-background/60">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                      style={{ width: `${40 + idx * 15}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border/60 bg-secondary/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Control actions</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                onClick={() => void handleMining()}
                disabled={!canMine || isMiningBusy}
                className="h-11 justify-center rounded-lg bg-primary text-primary-foreground transition hover:bg-primary/90"
              >
                {isMiningBusy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Queue Next Run
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="h-11 justify-center rounded-lg border-dashed border-border/70 bg-background/40 text-sm text-foreground"
                asChild
              >
                <Link href="/mining">View session planner</Link>
              </Button>
              <Button
                variant="secondary"
                className="h-11 justify-center rounded-lg border border-border/70 bg-background/60 text-sm"
                asChild
              >
                <Link href="/deposit">Add signal credits</Link>
              </Button>
              <Button
                variant="ghost"
                className="h-11 justify-center rounded-lg text-sm text-muted-foreground"
                asChild
              >
                <Link href="/team">Notify crew</Link>
              </Button>
            </div>
          </div>
        </div>

        {mining.requiresDeposit && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="h-4 w-4" />
              Funding required to unlock the next run.
            </div>
            <p className="mt-1 text-destructive/80">Minimum top-up: ${mining.minDeposit?.toFixed(0) ?? 30} USDT.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
