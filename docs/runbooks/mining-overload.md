# Mining Click Overload Runbook

This runbook covers the operational steps for diagnosing and recovering from overload conditions on the mining click pipeline.

## 1. Quick reference

| Signal | Threshold | Action |
| --- | --- | --- |
| HTTP 429 rate | > 5% sustained for 1 min | Increase rate limits or add capacity after verifying queue depth |
| Queue depth (`mining-clicks`) | > 4,500 jobs | Pause new intake via edge throttling; scale workers |
| Worker lag (`mining:metrics` `processed` vs `failed`) | Lag > 60s | Scale workers or investigate DB/Redis health |
| Redis latency | > 5 ms p99 | Move queue to dedicated Redis tier |

## 2. Triage checklist

1. **Confirm symptom**
   - Look at Grafana dashboard *Mining Click Health* (see `docs/monitoring/mining-dashboard.md`).
   - Check API logs for spikes in `Too many requests` responses.
2. **Inspect queue**
   - Run `pnpm ts-node scripts/queues/inspect-mining.ts` (see README) or use `bull-board` UI.
   - Validate `mining-clicks` waiting count and active worker count.
3. **Check Redis**
   - `redis-cli -u $REDIS_URL INFO latency` to confirm server health.
4. **Check worker pods**
   - `kubectl get pods -l app=mining-click-worker` ensure they are running and not crash looping.

## 3. Mitigation steps

1. **Backpressure**
   - Lower edge limits temporarily (e.g. Cloudflare Worker) to 1/3 normal throughput.
   - Optionally set `MINING_QUEUE_MAX_DEPTH` to a smaller number and redeploy API for faster 429s.
2. **Scale workers**
   - Increase replicas of `mining-click-worker` deployment or bump concurrency via `MINING_WORKER_CONCURRENCY` env var.
   - Monitor DB CPU to keep utilization < 70%.
3. **Database hotfixes**
   - If MongoDB connections saturate, ensure `pgbouncer`/`mongos` style pooling is healthy.
   - Clear stalled sessions using `db.currentOp()` and `db.killOp()` cautiously.
4. **Warm cache**
   - Increase CDN cache TTL for `/api/mining/status` to reduce DB pressure.

## 4. Validation before closing incident

- Queue depth below 500 and draining steadily.
- Worker error rate < 0.5% for last 10 minutes.
- API latency p95 for read endpoints < 300 ms.
- Monitoring dashboard back to green; alert cleared.

## 5. Post-incident follow-up

- File a report with peak queue depth, duration, and root cause.
- Capture Redis INFO snapshots for capacity planning.
- Consider raising default worker count or enabling autoscaling triggers.
