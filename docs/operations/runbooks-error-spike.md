# Runbook: Error Rate Spike (5xx)

## Trigger
- Prometheus alert `DirectStockHighErrorRate` fires.

## On-call order
1. Primary backend on-call
2. Security on-call (if auth/integrations are affected)
3. Platform/infra on-call

## Quick links
1. Grafana dashboard: [DirectStock Overview](http://localhost:3000/d/directstock-overview/directstock-overview)
2. Prometheus alert view: [Alerts](http://localhost:9090/alerts)
3. Backend docs: [OpenAPI](http://localhost:8080/api/docs)

## Immediate checks
1. Inspect error ratio query:
   - `sum(rate(http_requests_total{status=~"5.."}[5m])) / clamp_min(sum(rate(http_requests_total[5m])), 0.001)`
   - Direct link:
     `http://localhost:9090/graph?g0.expr=sum(rate(http_requests_total%7Bstatus%3D~%225..%22%7D%5B5m%5D))%20%2F%20clamp_min(sum(rate(http_requests_total%5B5m%5D))%2C%200.001)`
2. Verify latest deploy and migrations.
3. Check `/api/health` and DB connectivity.

## Triage
1. Find failing endpoints via `http_requests_total` grouped by status/handler.
2. Correlate request IDs from logs and traces (`X-Request-ID`).
3. Validate external dependency health (carrier APIs, DB, storage).

## Mitigation
1. Roll back latest application change if regression is release-bound.
2. Temporarily disable failing optional integrations.
3. For persistent 5xx from one endpoint, route-gate or feature-flag that endpoint.

## Exit criteria
- 5xx ratio < 1% for 30 minutes.
- No active critical alerts.
