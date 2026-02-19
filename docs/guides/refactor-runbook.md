# Refactor Runbook

## Program Contract (9/10 Target)
The refactor program is measured against:
1. `docs/validation/engineering-scorecard.md`
2. `docs/validation/metrics/complexity-latest.md`
3. `docs/validation/metrics/test-flakiness-latest.md`
4. `docs/validation/metrics/ci-duration-latest.md`

A refactor wave is complete only when changed-scope metrics improve or remain stable versus the previous baseline.

## Required Gates Before Merge
1. Frontend lint + format check + unit tests + build.
2. Backend ruff check + format check + pytest.
3. OpenAPI contract drift guard (`./scripts/check_api_contract_drift.sh`).
4. E2E hermetic guard (`./scripts/check_e2e_hermetic.sh`).
5. `pre-commit run --all-files`.
6. Smoke endpoints: `/health`, `/api/health`, `/api/docs`.
7. Performance budgets (`./scripts/perf/run_perf_smoke.sh` + `./scripts/perf/assert_budgets.sh`) for perf-relevant scope.
8. Security gates (`./scripts/check_security_gates.sh`) for auth/mutation/data-integrity relevant scope.
9. Observability smoke (`./scripts/observability/smoke.sh`) for observability/runtime config changes.
10. Agent governance debt scan (`./scripts/agent_governance_check.sh`) for AGENTS/docs/tooling waves.
11. Agent policy parity lint (`python3 scripts/agent_policy_lint.py --strict --provider all --format json`) for provider/governance waves.

## Mandatory Wave Metrics
Update these after every merged wave PR:

```bash
./scripts/collect_complexity_metrics.sh
RUNS=20 TEST_FLAKE_CMD="cd frontend && npm run test:e2e:smoke" ./scripts/collect_test_flakiness.sh
CI_BRANCH_FILTER=main CI_RUN_LIMIT=20 ./scripts/collect_ci_duration.sh
```

## Exit Criteria By Category
1. Modularity: no production file >500 LOC, no page/router file >350 LOC.
2. Test reproducibility: E2E flake rate below 1%.
3. CI velocity: median CI duration below 15 minutes.
4. Contract safety: no unapproved OpenAPI breaking drift.
5. Security baseline: no mutation endpoint without permission/audit/idempotency coverage.

## Rollback Strategy (Risk-Wave PRs)
1. Keep each PR focused on one wave objective.
2. If regression is found:
   - isolate the failing wave PR,
   - revert only that PR's commit range,
   - keep guard/tooling PRs intact.
3. Re-run full gates and regenerate affected scorecard metrics.

## Merge Discipline
1. No drive-by schema changes.
2. No breaking API changes without approval.
3. Keep audit/idempotency behavior intact.
4. Scope must follow `docs/guides/refactor-scope-allowlist.md`.
5. PR must include a short scorecard delta summary.
