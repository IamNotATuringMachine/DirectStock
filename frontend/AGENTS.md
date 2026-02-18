# AGENTS.md (Frontend Scope)

Scope: applies to all files under `frontend/`.

`/AGENTS.md` remains canonical for global policy. This file adds frontend-specific deltas only.

## Frontend Deltas
- Access backend only through `frontend/src/services/*`.
- Preserve role-based navigation consistency with backend RBAC.
- Preserve the centralized offline queue design (`offlineQueue.ts`), no parallel queue implementation.
- Keep critical user flows testable with stable `data-testid` attributes.
- Keep PWA UX behavior (install prompt, offline indicator, update banner).

## Build And Test Focus (Frontend)
At minimum for frontend-affecting changes, run:

```bash
cd frontend && npm run test
```

Run additional checks when applicable (for example `npm run build` and E2E flows) before shipping major UI changes.

## UI/Contract Hygiene
- Keep frontend API types consistent with backend schemas.
- Do not bypass service-layer abstractions with inline fetch logic.
- Avoid regressions in responsive behavior and mobile sidebar/app-shell flows.
