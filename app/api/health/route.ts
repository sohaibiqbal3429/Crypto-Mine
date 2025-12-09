import { NextResponse } from "next/server"

import { withRequestTiming } from "@/lib/observability/timing"

export async function GET() {
  return withRequestTiming("api.health", async () => {
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString() })
  }, {
    timeoutMs: 500, // keep this check extremely fast and isolated
    slowThresholdMs: 400,
  })
}
