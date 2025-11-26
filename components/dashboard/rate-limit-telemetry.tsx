"use client"

import { useEffect, useRef, useState, memo } from "react"
import { AlertTriangle, Clock3 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface TelemetryLayer {
  layer: string
  requestRatePerSecond: number
  throttleEventsLastWindow: number
  p95LatencyMs: number | null
}
interface TelemetryResponse {
  windowMs: number
  lastUpdated: string
  layers: TelemetryLayer[]
}

const MIN_REFRESH_MS = 1000;      // faster when healthy
const MAX_REFRESH_MS = 30000;     // gentle on errors

function formatLatency(v: number | null) {
  if (v === null || !Number.isFinite(v)) return "—"
  return `${Math.round(v)} ms`
}
function formatThrottleRate(events: number, windowMs: number) {
  if (windowMs <= 0) return "0 / window"
  const perSecond = events / (windowMs / 1000)
  return `${events} / ${Math.round(windowMs / 1000)}s (${perSecond.toFixed(2)}/s)`
}

/** small, memoized tile to avoid re-render churn */
const Tile = memo(function Tile({ layer, windowMs }: { layer: TelemetryLayer; windowMs: number }) {
  return (
    <div className="w-full rounded-3xl border border-white/40 bg-white/70 p-4 shadow-inner backdrop-blur-md dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
        <span>{layer.layer}</span>
        <Clock3 className="h-4 w-4" aria-hidden />
      </div>
      <dl className="mt-3 space-y-2 text-sm text-foreground dark:text-white">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Request rate</dt>
          <dd className="font-semibold">{layer.requestRatePerSecond.toLocaleString()} /s</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Throttle hits</dt>
          <dd className="font-semibold">{formatThrottleRate(layer.throttleEventsLastWindow, windowMs)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">p95 latency</dt>
          <dd className="font-semibold">{formatLatency(layer.p95LatencyMs)}</dd>
        </div>
      </dl>
    </div>
  )
})

export function RateLimitTelemetryCard() {
  const [layers, setLayers] = useState<TelemetryLayer[]>([])
  const [windowMs, setWindowMs] = useState<number>(60_000)
  const [status, setStatus] = useState<"live" | "degraded">("live")
  const [updatedLabel, setUpdatedLabel] = useState<string>("")
  const backoffRef = useRef<number>(MIN_REFRESH_MS)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlight = useRef<AbortController | null>(null)

  const schedule = (ms: number) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(tick, ms)
  }

  const tick = async () => {
    // pause when tab hidden (saves CPU/network)
    if (document.visibilityState === "hidden") {
      schedule(5000)
      return
    }

    try {
      inFlight.current?.abort()
      const ac = new AbortController()
      inFlight.current = ac

      const res = await fetch("/api/observability/rate-limit", {
        cache: "no-store",
        signal: ac.signal,
      })
      if (!res.ok) throw new Error(String(res.status))
      const data: TelemetryResponse = await res.json()

      setLayers(data.layers)
      setWindowMs(data.windowMs)
      setUpdatedLabel(new Date(data.lastUpdated).toLocaleTimeString())
      setStatus("live")

      // success → reset backoff and refresh quickly
      backoffRef.current = MIN_REFRESH_MS
      schedule(backoffRef.current)
    } catch (e) {
      console.error("telemetry fetch failed", e)
      setStatus("degraded")
      // exponential backoff (caps at 30s)
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_REFRESH_MS)
      schedule(backoffRef.current)
    }
  }

  useEffect(() => {
    schedule(MIN_REFRESH_MS)
    const onVis = () => schedule(100) // immediately refresh when tab comes back
    document.addEventListener("visibilitychange", onVis)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      inFlight.current?.abort()
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [])

  const windowLabel = `${Math.round(windowMs / 1000)} seconds`

  return (
    <Card className="relative col-span-full overflow-hidden rounded-[32px] border border-white/30 bg-white/70 px-6 py-6 shadow-[0_25px_50px_rgba(87,65,217,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.45),_transparent_65%)]" aria-hidden />
      <CardContent className="relative space-y-5 px-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Network telemetry</p>
            <p className="text-2xl font-semibold text-foreground dark:text-white">Rate-limit health</p>
            <p className="text-sm text-muted-foreground">
              Live request rate, throttle hits, and latency for the last {windowLabel} window.
            </p>
          </div>
          <span
            className={cn(
              "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em]",
              status === "degraded"
                ? "border border-rose-300 bg-rose-50/70 text-rose-700 dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-100"
                : "border border-emerald-200 bg-emerald-50/80 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-100",
            )}
          >
            {status === "degraded" ? "Degraded" : "Live"}
          </span>
        </div>

        {status === "degraded" ? (
          <div className="flex items-center gap-3 rounded-3xl border border-rose-200/60 bg-rose-50/80 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-100">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            Unable to load live telemetry. Retrying automatically.
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {layers.length ? (
            layers.map((l) => <Tile key={l.layer} layer={l} windowMs={windowMs} />)
          ) : status !== "degraded" ? (
            <div className="rounded-3xl border border-dashed border-white/50 bg-white/40 p-4 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/5">
              Awaiting traffic to populate telemetry.
            </div>
          ) : null}
        </div>

        {updatedLabel && (
          <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
            Last updated {updatedLabel} • Auto-refresh (backoff): {backoffRef.current / 1000}s
          </p>
        )}
      </CardContent>
    </Card>
  )
}
