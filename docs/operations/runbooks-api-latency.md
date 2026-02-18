# Runbook: API Latency Spike

## Trigger
- Grafana panel `HTTP Latency p95` rises above 400ms (core) or 900ms (reports) for >= 10 minutes.

## On-call order
1. Primary backend on-call
2. Platform/infra on-call
3. Product owner (if customer-visible degradation > 15 minutes)

## Quick links
1. Grafana dashboard: [DirectStock Overview](http://localhost:3000/d/directstock-overview/directstock-overview)
2. Prometheus UI: [Targets](http://localhost:9090/targets)
3. Backend health: [API Health](http://localhost:8080/api/health)

## Immediate checks
1. Confirm health endpoints:
   - `GET /health`
   - `GET /api/health`
2. Check Prometheus:
   - `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))`
   - Direct link:
     `http://localhost:9090/graph?g0.expr=histogram_quantile(0.95%2C%20sum(rate(http_request_duration_seconds_bucket%5B5m%5D))%20by%20(le))`
3. Check slow query burst:
   - `sum(increase(directstock_db_slow_query_total[5m]))`

## Triage
1. Identify top slow endpoints by handler label in `http_request_duration_seconds_bucket`.
2. Correlate with OTel traces in collector logs (search by `http.request_id`).
3. Verify DB bottleneck by inspecting `directstock_db_query_duration_seconds`.

## Mitigation
1. Reduce traffic for expensive endpoints (temporary feature flag or routing rule).
2. Roll back latest deployment if regression started directly after release.
3. Add/restore missing DB indexes through additive migration (no manual DDL).

## Exit criteria
- p95 back below budget for 30 minutes.
- No active latency alert in Prometheus.
