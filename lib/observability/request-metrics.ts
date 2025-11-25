import { incrementCounter, recordGauge, type MetricTags } from "@/lib/observability/metrics"

interface LayerMetrics {
  hits: number[]
  latencies: number[]
  throttles: number[]
  lastComputedP95: number | null
}

interface RequestMetricsState {
  layers: Map<string, LayerMetrics>
}

const ONE_SECOND_MS = 1000
const THROTTLE_WINDOW_MS = 60_000
const MAX_LATENCY_SAMPLES = 500

type GlobalWithMetrics = typeof globalThis & {
  __REQUEST_METRICS_STATE__?: RequestMetricsState
}

function getState(): RequestMetricsState {
  const globalScope = globalThis as GlobalWithMetrics
  const existing = globalScope.__REQUEST_METRICS_STATE__
  if (existing) {
    return existing
  }

  const initial: RequestMetricsState = {
    layers: new Map<string, LayerMetrics>(),
  }

  globalScope.__REQUEST_METRICS_STATE__ = initial
  return initial
}

function getLayerState(layer: string): LayerMetrics {
  const state = getState()
  if (!state.layers.has(layer)) {
    state.layers.set(layer, { hits: [], latencies: [], throttles: [], lastComputedP95: null })
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return state.layers.get(layer)!
}

export function trackRequestRate(layer: string, tags: MetricTags = {}): void {
  const now = Date.now()
  const layerState = getLayerState(layer)
  layerState.hits = layerState.hits.filter((ts) => now - ts < ONE_SECOND_MS)
  layerState.hits.push(now)

  recordGauge("request_rate_current_per_s", layerState.hits.length, { layer, ...tags })
}

export function recordThrottleHit(layer: string, scope: string, tags: MetricTags = {}): void {
  const now = Date.now()
  const layerState = getLayerState(layer)
  layerState.throttles = layerState.throttles.filter((ts) => now - ts < THROTTLE_WINDOW_MS)
  layerState.throttles.push(now)

  incrementCounter("rate_limit_throttle_total", 1, { layer, scope, ...tags })
}

export function recordRequestLatency(layer: string, durationMs: number, tags: MetricTags = {}): void {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return
  }

  const layerState = getLayerState(layer)
  if (layerState.latencies.length >= MAX_LATENCY_SAMPLES) {
    layerState.latencies.shift()
  }
  layerState.latencies.push(durationMs)

  const sorted = [...layerState.latencies].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * 0.95))
  const p95 = sorted[index] ?? durationMs
  layerState.lastComputedP95 = p95

  recordGauge("request_latency_p95_ms", p95, { layer, ...tags })
}

export interface RateLimitLayerSnapshot {
  layer: string
  requestRatePerSecond: number
  throttleEventsLastWindow: number
  windowMs: number
  p95LatencyMs: number | null
}

export function getRateLimitTelemetrySnapshot(options: { windowMs?: number } = {}): RateLimitLayerSnapshot[] {
  const now = Date.now()
  const { windowMs = THROTTLE_WINDOW_MS } = options
  const state = getState()

  return Array.from(state.layers.entries()).map(([layer, metrics]) => {
    metrics.hits = metrics.hits.filter((ts) => now - ts < ONE_SECOND_MS)
    metrics.throttles = metrics.throttles.filter((ts) => now - ts < windowMs)

    return {
      layer,
      requestRatePerSecond: metrics.hits.length,
      throttleEventsLastWindow: metrics.throttles.length,
      windowMs,
      p95LatencyMs: metrics.lastComputedP95,
    }
  })
}
