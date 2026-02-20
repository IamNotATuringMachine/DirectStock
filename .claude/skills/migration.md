---
name: Migration
description: Plan and execute safe database migrations with rollback and contract validation
---

# Migration Skill

## When to Use
When changing database schema, seed behavior, or data backfills that require Alembic migration(s).

## Steps

1. **Inspect current schema and model contract**:
   - Review `backend/app/models/` and relevant `backend/app/schemas/`.
   - Confirm API impact before writing migration logic.

2. **Create additive migration first**:
   ```bash
   cd backend && alembic revision --autogenerate -m "<short-description>"
   ```
   - Prefer additive changes before destructive operations.
   - Keep migration deterministic and idempotent for repeated CI execution.

3. **Review generated migration file**:
   - Validate constraints, indexes, defaults, and nullable transitions.
   - Avoid unsafe data-loss operations without explicit rollout and rollback notes.

4. **Run migration checks locally**:
   ```bash
   cd backend && python -m pytest -q tests/test_migrations.py
   cd backend && alembic upgrade head
   cd backend && alembic downgrade -1
   cd backend && alembic upgrade head
   ```

5. **Validate contract alignment**:
   ```bash
   ./scripts/check_api_contract_drift.sh
   ./scripts/check_mutation_integrity.py
   ```

6. **Document rollback path**:
   - Record exact rollback command(s) and any data restore implications in the task report.

## Invariants
- Schema changes must keep RBAC/audit/idempotency behavior intact for mutations.
- Migration should remain reviewable and narrowly scoped.
- API/schema/type drift must be resolved in the same change set.

## Anti-Patterns
- Do NOT merge schema changes without migration verification.
- Do NOT rely on manual production DB edits.
- Do NOT leave rollback strategy undefined.
