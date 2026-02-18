# Refactor Runbook

## Required Gates Before Merge
1. Frontend lint + format check + unit tests + build.
2. Backend ruff check + format check + pytest.
3. `pre-commit run --all-files`.
4. Smoke endpoints: `/health`, `/api/health`, `/api/docs`.

## Rollback Strategy (Single Large PR)
1. Keep refactor in ordered commits by module.
2. If regression found:
   - isolate failing module commit,
   - revert only that commit range,
   - keep foundation/tooling commits.
3. Re-run full gates after partial rollback.

## Merge Discipline
1. No drive-by schema changes.
2. No breaking API changes without approval.
3. Keep audit/idempotency behavior intact.
4. Scope must follow `docs/guides/refactor-scope-allowlist.md`.
