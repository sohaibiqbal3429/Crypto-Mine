# Crypto-Mine High Concurrency Guide

This document explains how to run the mining application with the new high-throughput protections, including Redis-backed rate limiting, asynchronous click processing, and observability.

## Architecture overview

```text
Browser (debounced click) → Next.js API (rate limit + queue) → Redis/BullMQ → Worker → MongoDB
                                           ↓
                                      Redis status cache + metrics
```

Key components:

- **Client debounce & idempotency** – the dashboard mining button throttles clicks and sends an `Idempotency-Key` header for every write.
- **Edge/API protection** – Redis token buckets enforce global, per-user, and per-IP quotas.
- **Asynchronous writes** – `/api/mining/click` enqueues requests in `mining-clicks`; workers call `performMiningClick` in the background.
- **Status tracking** – request state is stored in Redis and queried via `/api/mining/click/status?key=<id>`.
- **Metrics & runbooks** – Prometheus metrics, Grafana layout, k6 load tests, and an overload runbook are provided.

## Prerequisites

1. MongoDB connection configured via `MONGODB_URI`.
2. Redis 6+ available (cloud or local) and reachable via `REDIS_URL`.
3. Node.js 20+, pnpm 10+.
4. (Optional) k6 CLI for load testing.

## Environment variables

Copy `.env.example` and set at minimum:

```bash
REDIS_URL=redis://localhost:6379/0
MINING_RATE_LIMIT_GLOBAL=12000
MINING_RATE_LIMIT_GLOBAL_BURST=24000
MINING_RATE_LIMIT_PER_USER=5
MINING_RATE_LIMIT_USER_BURST=10
MINING_RATE_LIMIT_PER_IP=20
MINING_RATE_LIMIT_IP_BURST=40
MINING_QUEUE_MAX_DEPTH=5000
MINING_WORKER_CONCURRENCY=4
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-email-password-or-app-password
ENABLE_DEV_OTP_FALLBACK=true
```

`ENABLE_DEV_OTP_FALLBACK` lets local environments surface OTP codes directly in the UI/logs when email/SMS providers aren't
configured. Set it to `false` (or remove it) in production so that OTP codes are only delivered through the configured transport.

Tune limits according to production capacity. Lower per-user/IP tokens to tighten abuse controls or raise global limits as the cluster grows.

## Running locally

```bash
pnpm install
pnpm dev              # starts Next.js API/UI
pnpm ts-node jobs/mining-click-worker.ts   # run in a separate terminal, or build a PM2/Nodemon wrapper
```

> Workers require `REDIS_URL`. Without Redis the API returns `503` for mining clicks.

## Load testing

1. Ensure you have a valid `auth-token` cookie (or disable auth for a test environment).
2. Run:

```bash
BASE_URL=https://staging.example.com AUTH_TOKEN="<jwt>" RPS=10000 USERS=1000 DURATION=60s \
  pnpm load:test
```

The script (`tests/load/mining-clicks.js`) issues 10k clicks/sec, polls status endpoints, and asserts acceptable status codes (<1% errors expected).

## Monitoring & alerts

- Prometheus + Grafana configuration: `docs/monitoring/mining-dashboard.md`
- Overload response procedures: `docs/runbooks/mining-overload.md`
- Redis metrics are captured through the shared exporter; ensure dashboards plot queue depth and worker lag.

## Deployment checklist

1. **Edge/CDN** – Configure Cloudflare (or equivalent) to cache `/api/mining/status` with `stale-while-revalidate` using provided headers.
2. **Workers** – Deploy `jobs/mining-click-worker.ts` as a container or PM2 process. Scale horizontally to keep queue depth < 1k.
3. **Autoscaling** – Enable HPA/queue-based autoscaling on the worker deployment using `mining_click_queue_depth` metric.
4. **Circuit breakers** – Add Cloudflare Worker rule returning cached dashboard when origin is overloaded (429 surge).
5. **DB pooling** – Run MongoDB through connection poolers (e.g., MongoDB Atlas auto-scaling). Monitor concurrency.

## Status endpoint contract

- `POST /api/mining/click`
  - Headers: `Idempotency-Key` (required).
  - Responses: `202 Accepted` (queued), `200 OK` (deduplicated), `429 Too Many Requests`, `503 Service Unavailable`.
- `GET /api/mining/click/status?key=<id>`
  - Returns `200`, `202`, or `429/409` if failed/throttled.

## Operational guidance

- Inspect status backlog using `redis-cli --raw XINFO GROUPS mining-clicks` or BullMQ UI.
- Run queue inspection script (to create) `pnpm ts-node scripts/queues/inspect-mining.ts` to view active jobs and metrics.
- Follow the runbook whenever `mining_click_queue_depth` exceeds 4,500 or worker errors rise.

## Acceptance criteria summary

- ✅ Handles 1k–10k concurrent users via queue + throttling.
- ✅ No duplicate writes (idempotency enforced in Redis + Mongo unique index).
- ✅ API read latency cached (`/api/mining/status` headers) < 300 ms p95.
- ✅ Worker backlog drains post-spike; metrics/alerts describe health.

## Backend/API alignment for web + mobile

- Both the web app and the Expo mobile client read the backend root from `API_BASE_URL` (see `.env.example` and `mobile/.env.example`). Point this at the same deployed backend, including the `/api` suffix (production: `https://mintminepro.com/api`; local dev: `http://localhost:3000/api`).
- Use per-environment files (`.env.local`, staging secrets, production secrets) to target dev/stage/prod without code changes. The Expo config also honors `EXPO_PUBLIC_API_BASE_URL` for EAS/CLI builds.
- API contracts for auth, wallet, mining, tasks, team, coins, and admin live in `types/api-contracts.ts`. Import these types in both clients to keep request/response shapes synchronized with the backend.
- Backend-only logic changes (business rules inside route handlers/services) do not require client edits as long as endpoint paths and response fields stay stable. If you change a contract (path, payload, response fields), update `types/api-contracts.ts` and the corresponding service modules in both apps.

### Production API base URL (shared by web + mobile)

- **Canonical base:** `https://mintminepro.com/api`
- **Example unauthenticated check:** `GET https://mintminepro.com/api/public/wallets` returns JSON with the public deposit wallets. This is a quick way to confirm the host is reachable in a browser or Postman without credentials.
- **Example authenticated check:** `GET https://mintminepro.com/api/wallet/balance` (requires the auth token/cookie). Use this from the web app or Postman with valid credentials to verify balances.
- The base path `/api` may show a 404 or blank page in a browser because only specific routes respond and most require JSON + authentication; that is expected.

### Safe vs. breaking backend changes

- **Safe:** Internal logic changes that keep endpoint paths, request params, and response payloads identical. Both clients automatically pick up the new behavior without code updates.
- **Breaking (client updates required):** Renaming endpoints, changing HTTP methods, altering required params, or modifying response field names/shapes. When this happens, update `types/api-contracts.ts` and the affected service calls in both web and mobile.

### Before deploying to production and launching the mobile app

1. Confirm `API_BASE_URL` (and `EXPO_PUBLIC_API_BASE_URL` for Expo builds) is set to `https://mintminepro.com/api` in your prod env vars for both web and mobile.
2. Smoke-test on production API with a real account: login, dashboard totals, mining start, deposit address fetch, withdraw submission, history, support, profile update.
3. Hit `GET https://mintminepro.com/api/public/wallets` in a browser/Postman to verify the host is reachable; optionally check an authenticated endpoint with valid credentials.
4. Ensure no breaking contract changes were made—compare against `types/api-contracts.ts` and regenerate clients if needed.
5. For extra safety, deploy to staging first and point both clients at the staging `API_BASE_URL`, then flip prod env vars once validated.
