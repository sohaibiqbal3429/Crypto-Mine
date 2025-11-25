import { NextResponse } from "next/server"

import { getRateLimitTelemetrySnapshot } from "@/lib/observability/request-metrics"

export function GET() {
  const windowMs = 60_000
  const snapshot = getRateLimitTelemetrySnapshot({ windowMs })

  return NextResponse.json(
    {
      windowMs,
      lastUpdated: new Date().toISOString(),
      layers: snapshot.map((layer) => ({
        layer: layer.layer,
        requestRatePerSecond: layer.requestRatePerSecond,
        throttleEventsLastWindow: layer.throttleEventsLastWindow,
        p95LatencyMs: layer.p95LatencyMs,
      })),
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  )
}
