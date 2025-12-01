"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Zap, Clock, AlertCircle, Coins } from "lucide-react"
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
    <Card className="dashboard-card col-span-full lg:col-span-2 crypto-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg">
              <Coins className="w-6 h-6 text-primary-foreground" />
            </div>
            {canMine && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full animate-pulse" />
            )}
          </div>
          <div>
            <div className="crypto-gradient-text text-xl font-bold">Mint-Coin Mining</div>
            <div className="text-sm text-muted-foreground dark:text-secondary-dark">Decentralized Mining Protocol</div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {feedback.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{feedback.error}</AlertDescription>
          </Alert>
        )}

        {feedback.success && (
          <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
            <Zap className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-success-dark">{feedback.success}</AlertDescription>
          </Alert>
        )}

        <div className="text-center space-y-6">
          <motion.div
            className="relative mx-auto w-40 h-40 flex items-center justify-center"
            whileHover={{ scale: canMine ? 1.05 : 1 }}
            whileTap={{ scale: canMine ? 0.95 : 1 }}
          >
            <div
              className={`w-full h-full rounded-full flex items-center justify-center text-5xl font-bold text-white shadow-2xl relative overflow-hidden ${
                canMine && !isMiningBusy
                  ? "bg-gradient-to-br from-primary to-accent cursor-pointer crypto-glow"
                  : "bg-gradient-to-br from-gray-400 to-gray-600 cursor-not-allowed"
              }`}
              onClick={canMine && !isMiningBusy ? handleMining : undefined}
            >
              <Coins className="w-16 h-16" />
              {canMine && !isMiningBusy && (
                <>
                  <motion.div
                    className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-accent opacity-30"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                  />
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                </>
              )}
            </div>
          </motion.div>

          <div className="space-y-3">
            {canMine ? (
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-success-dark px-4 py-2"
              >
                <Zap className="w-4 h-4 mr-2" />
                Mining Available
              </Badge>
            ) : mining.requiresDeposit ? (
              <Badge
                variant="secondary"
                className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-error-dark px-4 py-2"
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                Deposit Required
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-warn-dark px-4 py-2"
              >
                <Clock className="w-4 h-4 mr-2" />
                Cooldown Period
              </Badge>
            )}
            <div className="bg-muted rounded-lg p-3">
              <p className="text-sm font-medium text-muted-foreground dark:text-secondary-dark">Next Mining Window</p>
              <p className="text-lg font-mono font-bold text-foreground dark:text-primary-dark">{nextWindowDisplay}</p>
            </div>
          </div>

          <Button
            onClick={() => void handleMining()}
            disabled={!canMine || isMiningBusy}
            size="lg"
            className="w-full max-w-sm h-12 text-lg font-semibold bg-gradient-to-r from-primary to-accent hover:from-accent hover:to-primary transition-all duration-300 shadow-lg hover:shadow-xl"
          >
            {isMiningBusy ? (
              <>
                <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                Mining in Progress...
              </>
            ) : (
              <>
                <Zap className="mr-3 h-5 w-5" />
                {canMine ? "Start Mining" : "Mining Unavailable"}
              </>
            )}
          </Button>

          {mining.requiresDeposit && (
            <Button
              asChild
              variant="outline"
              className="w-full max-w-sm h-11 border-dashed border-slate-300 text-sm font-semibold"
            >
              <Link href="/wallet/deposit">
                Make a deposit (min ${mining.minDeposit?.toFixed(0) ?? 30} USDT)
              </Link>
            </Button>
          )}

          {mining.earnedInCycle > 0 && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <p className="text-sm text-muted-foreground dark:text-muted-dark mb-1">Last Mining Cycle</p>
              <p className="text-2xl font-bold crypto-gradient-text">+${mining.earnedInCycle.toFixed(2)}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
