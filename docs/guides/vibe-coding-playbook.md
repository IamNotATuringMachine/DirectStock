# Vibe Coding Playbook

## Ziel
Schnelle, sichere Iterationen mit kleinen, validierten Schritten und reproduzierbaren Gates.

## Task-Templates

### Bugfix
1. Reproduktion mit minimalem Testfall.
2. Lokale Ursache auf Modulgrenze eingrenzen.
3. Minimalen Fix implementieren.
4. Relevante Unit/E2E-Checks ausführen.
5. Risiko + Scope im PR-Text dokumentieren.

### Refactor
1. Verhaltensgrenzen festlegen (API, RBAC, Offline-Flow).
2. Erst Code verschieben, dann intern vereinfachen.
3. Contract-Tests zuerst grün halten.
4. Nur danach interne APIs konsolidieren.

### Feature
1. Additiven Vertrag zuerst definieren.
2. Backend-Guard + Audit + Idempotency absichern.
3. Frontend nur über Service-Layer anbinden.
4. Tests und Doku in derselben Änderung liefern.

## Safe-Slicing Checkliste
1. Keine Route-/Schema-Breaks ohne explizite Freigabe.
2. `ApiError` Format unverändert.
3. `X-Client-Operation-Id` Verhalten unverändert.
4. PR-Scope gegen `docs/guides/refactor-scope-allowlist.md` prüfen.
5. Vor Merge: lint, tests, build, smoke.

## Proof-First Regeln
1. Small-diff first: pro Änderung nur ein klarer Zweck (Refactor, Guard, Test oder Doku).
2. Proof before polish: erst grüne Gates, dann sekundäre Struktur-/Style-Anpassungen.
3. Contracts first: API-/RBAC-/Idempotency-Verhalten muss vor und nach dem Refactor gleich bleiben.
4. Deterministic evidence: immer reproduzierbare Commands und Exit-Status mitliefern.

## Command Matrix
```bash
# Frontend
cd frontend && npm run test:e2e:hermetic
cd frontend && npm run lint
cd frontend && npm run format:check
cd frontend && npm run test
cd frontend && npm run build

# Backend
cd backend && ruff check --config ruff.toml app tests
cd backend && ruff format --config ruff.toml --check app tests
cd backend && python -m pytest -q
./scripts/check_api_contract_drift.sh

# Repo
pre-commit run --all-files
./scripts/autonomous_task_harness.sh
./scripts/collect_complexity_metrics.sh
RUNS=20 TEST_FLAKE_CMD="cd frontend && npm run test:e2e:smoke" ./scripts/collect_test_flakiness.sh
CI_RUN_LIMIT=20 ./scripts/collect_ci_duration.sh
./scripts/perf/run_perf_smoke.sh
./scripts/perf/assert_budgets.sh
./scripts/install_gitleaks.sh
./scripts/check_security_gates.sh
./scripts/observability/smoke.sh
```
