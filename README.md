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
```

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

## Mobile app & APK distribution

- The React Native client lives in `/mobile` and mirrors the dashboard experience using React Query and Zustand. Set `API_BASE_URL` in `mobile/.env` (or your preferred env solution) to point at the deployed Next.js origin.
- Generate a signed Android release with `cd mobile && npm install && cd android && ./gradlew assembleRelease`. Upload the resulting `app-release.apk` to the CDN bucket referenced by `MOBILE_APK_DOWNLOAD_URL`.
- Surface the new URL, version, build date, and optional release notes through environment variables listed in `.env.example`. The website's “Download Mobile App” button reads `/api/mobile-app/apk` and updates the modal in real time.
- Mobile metadata is cached client side with SWR and revalidated on window focus, mirroring the polling strategy of the web dashboard.

## Acceptance criteria summary

- ✅ Handles 1k–10k concurrent users via queue + throttling.
- ✅ No duplicate writes (idempotency enforced in Redis + Mongo unique index).
- ✅ API read latency cached (`/api/mining/status` headers) < 300 ms p95.
- ✅ Worker backlog drains post-spike; metrics/alerts describe health.
