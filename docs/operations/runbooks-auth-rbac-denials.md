# Runbook: Auth/RBAC Denial Spike (401/403)

## Trigger
- Sudden rise in 401/403 responses for previously healthy workflows.
- Prometheus alert `DirectStockRbacDenialsSpike` fires.

## On-call order
1. Primary backend on-call
2. IAM/security owner
3. Product owner for affected module

## Quick links
1. Grafana dashboard: [DirectStock Overview](http://localhost:3000/d/directstock-overview/directstock-overview)
2. Prometheus denials graph:
   `http://localhost:9090/graph?g0.expr=sum(rate(http_requests_total%7Bstatus%3D~%22401%7C403%22%7D%5B5m%5D))`
3. Auth endpoint health: [Login endpoint](http://localhost:8080/api/docs#/auth/login_api_auth_login_post)

## Immediate checks
1. Validate auth service endpoints:
   - `POST /api/auth/login`
   - `POST /api/auth/refresh`
2. Inspect whether denials are 401 (authn) or 403 (authz).
3. Review recent role/permission seed or migration changes.

## Triage
1. For 401: check token expiry, signing secret, token version revocation.
2. For 403: confirm required permission codes on impacted endpoints.
3. Verify no accidental deny-overrides were applied to users.

## Mitigation
1. Restore intended role-permission mapping through additive seed/migration fix.
2. Revoke stale tokens and force re-login if token version mismatch is widespread.
3. Roll back the last RBAC change if blast radius is broad.

## Exit criteria
- 401/403 rates return to baseline.
- Access matrices in RBAC tests pass for affected modules.
