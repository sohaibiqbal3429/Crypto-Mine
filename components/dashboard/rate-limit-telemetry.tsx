"use client"

import { useEffect, useMemo, useState } from "react"
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

const REFRESH_INTERVAL_MS = 5000

function formatLatency(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—"
  }

  return `${Math.round(value)} ms`
}

function formatThrottleRate(events: number, windowMs: number): string {
  if (windowMs <= 0) {
    return "0 / window"
  }

  const perSecond = events / (windowMs / 1000)
  return `${events} / ${Math.round(windowMs / 1000)}s (${perSecond.toFixed(2)}/s)`
}

export function RateLimitTelemetryCard() {
  const [telemetry, setTelemetry] = useState<TelemetryLayer[]>([])
  const [windowMs, setWindowMs] = useState<number>(60_000)
  const [lastUpdated, setLastUpdated] = useState<string>("")
  const [error, setError] = useState<string | null>(null)

  const windowLabel = useMemo(() => `${Math.round(windowMs / 1000)} seconds`, [windowMs])

  useEffect(() => {
    let cancelled = false

    const loadTelemetry = async () => {
      try {
        const response = await fetch("/api/observability/rate-limit", { cache: "no-store" })
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }

        const payload: TelemetryResponse = await response.json()
        if (cancelled) {
          return
        }

        setTelemetry(payload.layers)
        setWindowMs(payload.windowMs)
        setLastUpdated(payload.lastUpdated)
        setError(null)
      } catch (err) {
        if (cancelled) {
          return
        }
        console.error("Failed to load rate limit telemetry", err)
        setError("Unable to load live rate limit telemetry.")
      }
    }

    void loadTelemetry()
    const interval = setInterval(() => {
      void loadTelemetry()
    }, REFRESH_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return (
    <Card className="col-span-full lg:col-span-2 crypto-card">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-primary" /> Rate Limit Telemetry
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Live request rate, throttle hits, and latency for the last {windowLabel} window.
          </p>
        </div>
        <Badge variant={error ? "destructive" : "outline"} className="uppercase tracking-wide text-xs">
          {error ? "Degraded" : "Live"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {telemetry.map((layer) => (
            <div key={layer.layer} className="rounded-lg border border-border/60 bg-muted/30 p-4 shadow-sm">
              <div className="flex items-center justify-between text-sm font-medium uppercase tracking-wide text-muted-foreground">
                <span>{layer.layer}</span>
                <Clock3 className="h-4 w-4 text-muted-foreground" />
              </div>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Request rate</dt>
                  <dd className="font-semibold text-foreground">{layer.requestRatePerSecond.toLocaleString()} /s</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Throttle hits</dt>
                  <dd className="font-semibold text-foreground">
                    {formatThrottleRate(layer.throttleEventsLastWindow, windowMs)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">p95 latency</dt>
                  <dd className="font-semibold text-foreground">{formatLatency(layer.p95LatencyMs)}</dd>
                </div>
              </dl>
            </div>
          ))}
          {telemetry.length === 0 && !error ? (
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground">
              Awaiting traffic to populate telemetry.
            </div>
          ) : null}
        </div>

        {lastUpdated ? (
          <p className="text-xs text-muted-foreground">
            Last updated {new Date(lastUpdated).toLocaleTimeString()} • Auto-refreshes every {Math.round(REFRESH_INTERVAL_MS / 1000)}
            s
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
