# AGENTS.md (Backend Scope)

Scope: applies to all files under `backend/`.

`/AGENTS.md` remains canonical for global policy.
Machine-readable policy contract: `docs/agents/policy.contract.yaml`.

Autonomy mode: unrestricted_senior

## Backend Deltas
- Prefer FastAPI routes under `/api/*` and preserve `/health` plus `/api/health`.
- Prefer standardized `ApiError` response shape (`code`, `message`, `request_id`, `details`).
- Prefer mutation audit logging, server-side RBAC, and offline idempotency (`X-Client-Operation-Id`).
- Prefer UTC timestamps.

These are backend defaults, not escalation triggers. High-risk or breaking backend work is allowed and must be documented via `docs/agents/decision-log.md`.

## Database Rules
- Prefer schema changes through Alembic migration files.
- Prefer preserving critical constraints/indexes unless intentionally changed.
- For high-risk migrations, follow the High-Risk Execution Protocol from `/AGENTS.md` and record rollback hints.

## Test Focus (Backend)
At minimum for backend-affecting changes, run:

```bash
cd backend && python -m pytest -q
```

If a targeted run is used during iteration, still run relevant final validation before completion.

## Change Hygiene
- API changes may be additive or breaking under `unrestricted_senior`; document intent and impact.
- Keep backend schemas and frontend types synchronized after each contract change.
- Keep provider parity valid with `python3 scripts/agent_policy_lint.py --strict --provider all --format json` for governance-impacting changes.
