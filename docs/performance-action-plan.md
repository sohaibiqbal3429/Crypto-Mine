# Performance & Scalability Action Plan

## Quick Wins (Low Effort, High Impact)

- Enable lean reads, projections, and cursor-based pagination across admin APIs to eliminate `skip/limit` scans and reduce payload sizes.
- Add essential compound indexes for the highest volume collections (users, transactions, payouts, logs, clicks) and enforce cached KPI lookups with 30s TTL.
- Introduce request-level rate limiting, tuned Mongo connection pooling, and compression to protect the edge and shrink TTFB.
- Virtualize admin data tables with debounced search and server-side filters to slash first paint times.
- Queue heavy exports via BullMQ to keep request paths non-blocking.

## Mid-Term Initiatives

- Move dashboard and KPI aggregations to scheduled BullMQ workers that hydrate the cache ahead of peak hours; expose cache hit metrics.
- Add Redis (or Mongo TTL cache with eviction) for frequently accessed aggregates, leaderboard widgets, and notification counts.
- Instrument the stack with OpenTelemetry tracing, Sentry error capture, and Datadog dashboards to monitor query latency, queue depth, and cache efficiency.
- Expand load testing (k6) coverage to include mining flows, payouts, and notification pipelines with automated regression thresholds.
- Harden schema defaults (e.g., user status) and ensure new writes populate denormalized fields needed for indexed searches.

## Long-Term Roadmap

- Shard or partition high-volume collections (transactions/logs) and adopt Atlas Online Archive or capped collections for logs to control growth.
- Introduce read replicas dedicated to analytics workloads and real-time dashboards; migrate long-running analytics to asynchronous data warehouses.
- Implement adaptive rate limiting + circuit breakers informed by telemetry to throttle abusive clients before they reach Mongo.
- Automate index drift detection (via Mongo profiler + scheduled reports) and integrate with CI to block unindexed query regressions.
- Formalize background job orchestration (workers, retries, dead-letter queues) and deploy horizontal autoscaling policies for queue processors.

## Effort vs. Impact Summary

| Initiative | Effort | Impact |
| --- | --- | --- |
| Cursor pagination & lean queries | S | High |
| Mongo index rollout | S | High |
| BullMQ export queues | M | High |
| Monitoring & tracing rollout | M | High |
| Cache-backed dashboards | M | Medium |
| Sharding/archival strategy | L | High |
| Adaptive rate limiting & circuit breakers | M | Medium |
| Automated index regression checks | M | Medium |
| Data warehouse offloading | L | Medium |
