"use client"

import { useEffect, useRef, useState, memo } from "react"
import { Activity, AlertTriangle, Clock3 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

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
    <div className="w-full rounded-lg border border-border/60 bg-muted/30 p-4 shadow-sm">
      <div className="flex items-center justify-between text-sm font-medium uppercase tracking-wide text-muted-foreground dark:text-secondary-dark">
        <span>{layer.layer}</span>
        <Clock3 className="h-4 w-4 text-muted-foreground dark:text-secondary-dark" />
      </div>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground dark:text-secondary-dark">Request rate</dt>
          <dd className="font-semibold text-foreground dark:text-primary-dark">
            {layer.requestRatePerSecond.toLocaleString()} /s
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground dark:text-secondary-dark">Throttle hits</dt>
          <dd className="font-semibold text-foreground dark:text-primary-dark">
            {formatThrottleRate(layer.throttleEventsLastWindow, windowMs)}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground dark:text-secondary-dark">p95 latency</dt>
          <dd className="font-semibold text-foreground dark:text-primary-dark">{formatLatency(layer.p95LatencyMs)}</dd>
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
    <Card className="dashboard-card w-full col-span-full crypto-card">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg text-foreground dark:text-primary-dark">
            <Activity className="h-5 w-5 text-primary" /> Rate Limit Telemetry
          </CardTitle>
          <p className="text-sm text-muted-foreground dark:text-secondary-dark">
            Live request rate, throttle hits, and latency for the last {windowLabel} window.
          </p>
        </div>
        <Badge variant={status === "degraded" ? "destructive" : "outline"} className="uppercase tracking-wide text-xs">
          {status === "degraded" ? "Degraded" : "Live"}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        {status === "degraded" ? (
          <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span>Unable to load live rate limit telemetry.</span>
          </div>
        ) : null}

        {/* single column, full width */}
        <div className="grid grid-cols-1 gap-4">
          {layers.length ? (
            layers.map((l) => <Tile key={l.layer} layer={l} windowMs={windowMs} />)
          ) : status !== "degraded" ? (
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground dark:text-secondary-dark">
              Awaiting traffic to populate telemetry.
            </div>
          ) : null}
        </div>

        {updatedLabel && (
          <p className="text-xs text-muted-foreground dark:text-muted-dark">
            Last updated {updatedLabel} • Auto-refresh (backoff): {backoffRef.current / 1000}s
          </p>
        )}
      </CardContent>
    </Card>
  )
}
