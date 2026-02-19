# Engineering Scorecard (9/10 Program)

Last updated: 2026-02-18

## Purpose
This scorecard is the binding measurement contract for the 12-week refactoring program.
All waves must update these metrics with reproducible commands before merge.

## Targets
| Criterion | 9/10 Exit Gate |
| --- | --- |
| Architecture / Modularity | No production file >500 LOC, no page/router file >350 LOC |
| Security Baseline | 100% mutating endpoints with permission guard + audit + idempotency |
| Data Integrity / Idempotency | Critical mutation paths have replay/conflict/timeout regression tests |
| API Contract Discipline | OpenAPI drift guard required, no unapproved breaking changes |
| Test Quality | Backend coverage >=88%, frontend coverage >=82%, E2E flake rate <1% |
| CI/CD Gates | Required lint/test/contract/scope/smoke, median CI duration <15 min |
| Frontend Maintainability | 0 direct backend fetch/axios calls in pages/components |
| Backend Maintainability | Router modules are orchestration-only for critical domains |
| Performance / Scaling | p95/p99 budgets met in staging load tests |
| Observability / Operability | End-to-end traces + SLO dashboards + actionable alert runbooks |
| DevEx / Tooling | Deterministic one-command verification in local + CI |
| LLM / Vibe Coding SOTA | Golden task first-pass gate success >=90% |
| Agent Governance Loop | Scheduled governance scan with debt issue auto-sync |

## Baseline Collection Commands
Run from repository root:

```bash
./scripts/collect_complexity_metrics.sh
RUNS=20 TEST_FLAKE_CMD="cd frontend && npm run test:e2e:smoke" ./scripts/collect_test_flakiness.sh
CI_RUN_LIMIT=20 ./scripts/collect_ci_duration.sh
```

Output artifacts:
1. `docs/validation/metrics/complexity-latest.md`
2. `docs/validation/metrics/test-flakiness-latest.md`
3. `docs/validation/metrics/ci-duration-latest.md`

## Review Cadence
1. Update metric artifacts at least once per wave.
2. Block merge when a changed wave regresses a bound metric without explicit waiver.
3. Record waivers in the PR body with owner and expiry date.

## Wave Completion Rule
A wave is complete only when:
1. All changed-scope tests are green.
2. Relevant scorecard metrics are updated.
3. No unresolved score regression remains in that wave's scope.
