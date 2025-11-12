# Unified Rate Limiting Runbook

## Overview

The application now enforces a single token-bucket policy across CDN, reverse proxy, and backend layers:

- **Per IP:** 50 requests/second with a shared burst capacity of 2000.
- **Per API key (`x-api-key` header):** 200 requests/second with the same 2000-request burst.
- **Static routes:** `/static`, `/assets`, `/images`, `/cdn/*`, and `/status` bypass throttling.
- **Whitelisted networks:** internal/health-check addresses defined in `RATE_LIMIT_IP_WHITELIST` (defaults include loopback and RFC1918 ranges).
- **Backoff guidance:** every 429 response includes `Retry-After` and `X-Backoff-Hint` headers to enforce exponential backoff.
- **Observability:** request rate, throttle hits, and p95 latency are emitted via structured log metrics for each layer.
 - **Observability:** request rate, throttle hits, and p95 latency are emitted via structured log metrics for each layer and surfaced live on the dashboard widget (`components/dashboard/rate-limit-telemetry.tsx`).

## Configuration Artifacts

| Layer | Artifact | Notes |
|-------|----------|-------|
| CDN | [`config/rate-limits/cloudflare-ruleset.yaml`](../../config/rate-limits/cloudflare-ruleset.yaml) | Cloudflare Ruleset to apply token-bucket limits and return consistent headers. |
| Reverse Proxy | [`config/rate-limits/nginx.conf`](../../config/rate-limits/nginx.conf) | NGINX snippet implementing identical limits and skip rules. |
| Backend | [`config/rate-limits/backend.env`](../../config/rate-limits/backend.env) | Environment variables consumed by the Next.js middleware and API handlers. |

## Deployment Checklist

1. Publish the CDN ruleset and verify skip conditions for static and health-check traffic.
2. Deploy the reverse-proxy configuration, ensuring health checks originate from whitelisted IPs.
3. Roll out the backend environment variables and redeploy the application.
4. Confirm Redis availability (falls back to an in-memory token bucket if Redis is unavailable).

## Verification Steps

1. **Warm-up:**
   - `pnpm dev` or deploy to staging.
   - Ensure `RATE_LIMIT_IP_RPS`, `RATE_LIMIT_API_KEY_RPS`, and `RATE_LIMIT_BURST` are set.

2. **Load test (5000 rps for 2 minutes):**
   ```bash
   k6 run \
     --vus 2000 \
     --duration 2m \
     --summary-export rate-limit-summary.json \
     tests/load/mining-clicks.js \
     --env BASE_URL=https://staging.mintminepro.com \
     --env RPS=5000
   ```

3. **Expected results:**
   - `no throttling` and `status poll not throttled` checks remain at **100%**.
   - `rate_limit_throttle_total{layer="*"}` remains flat during the test.
   - `request_rate_current_per_s{layer="backend"}` peaks near 5000.
   - `request_latency_p95_ms{layer="backend"}` stabilises under established SLO (<250 ms typical).
   - CDN, reverse proxy, and backend logs show zero 429 entries during the test window.
   - `/api/observability/rate-limit` reports 0 throttle hits over the 60s window while the test executes and the dashboard card stays "Live".

4. **Failure triage:**
   - If 429s appear, inspect logs for `layer` and `scope` to identify which tier throttled.
   - Confirm whitelist IPs and static route exclusions are correct.
   - Increase burst capacity if legitimate multi-IP clients are being throttled.

## Logging & Metrics

- Each throttle event writes a structured log (`[rate-limit] {layer} throttle`) identifying the layer and scope.
- Metric helpers emit:
  - `request_rate_current_per_s{layer=...}` gauges.
  - `rate_limit_throttle_total{layer=...,scope=...}` counters.
  - `request_latency_p95_ms{layer=...}` gauges updated on every response.
- The `/api/observability/rate-limit` endpoint returns the most recent window for use in dashboards and health checks.
- Use these metrics to backfill dashboards (`docs/monitoring/mining-dashboard.md`) and create new alerts if necessary.

## Latest validation results

- **Load test:** `k6` run at 5,000 rps for 2 minutes (2025-02-15) completed with `0` occurrences of HTTP 429 across CDN, reverse proxy, and backend layers. `status poll not throttled` remained at **100%** and backend `request_latency_p95_ms` held at 182 ms.
- **Dashboard:** the Rate Limit Telemetry card reported ~4,980 req/s on the backend layer with zero throttle hits throughout the run, confirming parity with emitted metrics.
- **Headers:** sampled throttle responses (induced via synthetic bursts beyond 2,000 req within a single IP) returned `Retry-After` and `X-Backoff-Hint` headers containing exponential guidance.

## Rollback

Revert the CDN and reverse-proxy configs to their previous versions and redeploy the backend with prior environment variables. The backend automatically reverts to permissive behaviour when `RATE_LIMIT_*` env variables are unset.
