# Runbook: Database Latency / Slow Query Burst

## Trigger
- Alert `DirectStockSlowQueryBurst` fires or DB p95 panel spikes.

## On-call order
1. Primary backend on-call
2. Database owner
3. Platform/infra on-call

## Quick links
1. Grafana dashboard: [DirectStock Overview](http://localhost:3000/d/directstock-overview/directstock-overview)
2. Prometheus slow-query graph:
   `http://localhost:9090/graph?g0.expr=sum(increase(directstock_db_slow_query_total%5B10m%5D))`

## Immediate checks
1. Validate DB container health and connection pool saturation.
2. Query slow counter:
   - `sum(increase(directstock_db_slow_query_total[10m]))`
3. Query DB p95:
   - `histogram_quantile(0.95, sum(rate(directstock_db_query_duration_seconds_bucket[5m])) by (le))`

## Triage
1. Identify SQL operation type with largest latency (`operation` label).
2. Check recent schema changes and query-heavy releases.
3. Confirm no long-running maintenance/migration process is active.

## Mitigation
1. Revert query-heavy deployment or disable expensive report path.
2. Add additive index migration for hot queries.
3. Increase DB resources only as temporary mitigation.

## Exit criteria
- Slow-query rate returns to baseline.
- DB p95 stays under threshold for 30 minutes.
