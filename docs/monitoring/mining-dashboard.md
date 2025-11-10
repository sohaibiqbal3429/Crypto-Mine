# Mining Click Observability

This document outlines the Prometheus metrics, Grafana panels, and alert rules for the mining click pipeline.

## Metrics

The API and worker expose the following Prometheus counters and gauges (via `/api/metrics` or a sidecar exporter):

| Metric | Type | Description |
| --- | --- | --- |
| `mining_click_requests_total{status="200|202|429"}` | Counter | Total click API responses, partitioned by HTTP status |
| `mining_click_queue_depth` | Gauge | Current `mining-clicks` queue depth from BullMQ |
| `mining_worker_processed_total` | Counter | Successful worker completions |
| `mining_worker_failed_total` | Counter | Worker failures, labelled by error code |
| `mining_worker_lag_seconds` | Gauge | Time difference between newest queued job and processing time |
| `redis_latency_ms` | Histogram | Redis command latency (from client instrumentation) |

## Grafana dashboard layout

1. **Overview row**
   - *RPS & status split*: `sum(rate(mining_click_requests_total[5m])) by (status)` stacked bar.
   - *Latency*: `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{route="/api/mining/*"}[5m])) by (le))`.
2. **Queue health row**
   - Queue depth time-series with alert threshold at 4,000.
   - Worker lag line chart using `mining_worker_lag_seconds`.
3. **Success vs failure**
   - SingleStat for last 5m success rate `sum(rate(mining_worker_processed_total[5m])) / (sum(rate(mining_worker_processed_total[5m])) + sum(rate(mining_worker_failed_total[5m])))`.
   - Table of top failure reasons by `error_code` label.
4. **Redis performance**
   - Histogram panel for `redis_latency_ms` p95.

## Alert rules (Prometheus)

```yaml
- alert: MiningQueueBackpressure
  expr: mining_click_queue_depth > 4500
  for: 2m
  labels:
    severity: warning
  annotations:
    summary: "Mining queue depth high"
    description: "Queue depth {{ $value }} exceeds safe threshold. Workers may be overloaded."

- alert: MiningWorkerFailures
  expr: rate(mining_worker_failed_total[5m]) > 5
  for: 3m
  labels:
    severity: critical
  annotations:
    summary: "Mining worker failures detected"
    description: "Workers failing at >5 per second. Investigate logs and DB connectivity."

- alert: MiningApi429Spike
  expr: sum(rate(mining_click_requests_total{status="429"}[5m])) / sum(rate(mining_click_requests_total[5m])) > 0.05
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "429 rate elevated"
    description: "More than 5% of mining click requests are throttled."
```

## Logging

- API logs include `idempotencyKey`, `userId`, and queue depth for each request.
- Worker logs emit job duration and MongoDB transaction timings.
- Send logs to Loki/Elastic with index `mining-click-*` for correlation with alerts.
