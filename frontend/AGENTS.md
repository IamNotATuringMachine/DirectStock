# AGENTS.md (Frontend Scope)

Scope: applies to all files under `frontend/`.

`/AGENTS.md` remains canonical for global policy.
Machine-readable policy contract: `docs/agents/policy.contract.yaml`.

Autonomy mode: unrestricted_senior

## Frontend Deltas
- Prefer backend access through `frontend/src/services/*`.
- Prefer role/navigation consistency with backend RBAC.
- Prefer centralized offline queue behavior (`offlineQueue.ts`).
- Prefer stable `data-testid` coverage for critical flows.
- Prefer stable PWA UX behavior (install prompt, offline indicator, update banner).

These are frontend defaults, not escalation triggers. High-risk or breaking frontend work is allowed and must be documented via `docs/agents/decision-log.md`.

## Build And Test Focus (Frontend)
At minimum for frontend-affecting changes, run:

```bash
cd frontend && npm run test
```

Run additional checks when applicable (for example `npm run build` and E2E flows) before completion.

## UI/Contract Hygiene
- Contract changes (including breaking changes) are allowed under `unrestricted_senior`.
- Keep frontend API types consistent with backend schemas after each contract change.
- Prefer service-layer abstractions over inline fetch logic unless intentionally bypassed.
- Keep provider parity valid with `python3 scripts/agent_policy_lint.py --strict --provider all --format json` for governance-impacting changes.
