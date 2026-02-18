# Runbook: Idempotency Conflict Burst

## Trigger
- Elevated `409 conflict` responses on offline mutation endpoints.

## On-call order
1. Primary backend on-call
2. Frontend/offline-sync owner
3. Product owner (if warehouse flows blocked)

## Quick links
1. Grafana dashboard: [DirectStock Overview](http://localhost:3000/d/directstock-overview/directstock-overview)
2. API health: [API Health](http://localhost:8080/api/health)

## Immediate checks
1. Confirm affected paths use `X-Client-Operation-Id` correctly.
2. Inspect conflict details payload (`existing_endpoint`, `request_endpoint`).
3. Verify no client-side replay storm is active.

## Triage
1. Determine whether conflicts are expected replays or cross-endpoint reuse bugs.
2. For repeated `already in progress`, inspect long-running requests and timeouts.
3. Validate that operation IDs are unique per mutation intent on clients.

## Mitigation
1. Fix client generator for operation IDs if cross-endpoint collisions occur.
2. Reduce retry aggressiveness in offline sync worker.
3. If needed, drain stuck in-progress operations after root-cause confirmation.

## Exit criteria
- Conflict rate returns to baseline.
- Replay semantics remain deterministic in regression tests.
