# Golden Task Report

Generated at: 2026-02-19T09:20:39Z

## Summary

- Mode: `smoke`
- Tasks executed: 10
- Passed: 10
- Failed: 0
- First-pass success: 100.00% (target >= 90.00%)

## Task Results

| Task | Category | Description | Status | Duration | Command |
| --- | --- | --- | --- | ---: | --- |
| gt01 | scope | Refactor scope guard | PASS | 1s | `./scripts/check_refactor_scope_allowlist.sh` |
| gt02 | maintainability | File-size guard | PASS | 0s | `SIZE_GUARD_MODE=changed ./scripts/check_file_size_limits.sh` |
| gt03 | contract | OpenAPI contract drift | PASS | 2s | `./scripts/check_api_contract_drift.sh` |
| gt04 | integrity | Mutation integrity guard | PASS | 2s | `if [ -x backend/.venv/bin/python ]; then backend/.venv/bin/python ./scripts/check_mutation_integrity.py; else python3 ./scripts/check_mutation_integrity.py; fi` |
| gt05 | frontend | Frontend lint | PASS | 2s | `(cd frontend && npm run lint)` |
| gt06 | frontend | Frontend tests | PASS | 2s | `(cd frontend && npm run test)` |
| gt07 | frontend | Frontend build | PASS | 6s | `(cd frontend && npm run build)` |
| gt08 | backend | Backend lint | PASS | 0s | `if [ -x backend/.venv/bin/ruff ]; then (cd backend && .venv/bin/ruff check --config ruff.toml app tests); else (cd backend && python3 -m ruff check --config ruff.toml app tests); fi` |
| gt09 | backend | Backend tests | PASS | 12s | `if [ -x backend/.venv/bin/python ]; then (cd backend && .venv/bin/python -m pytest -q tests/test_seed.py tests/test_auth_seed_contract.py); else (cd backend && python3 -m pytest -q tests/test_seed.py tests/test_auth_seed_contract.py); fi` |
| gt10 | performance | Perf smoke budget | PASS | 100s | `./scripts/perf/run_perf_smoke.sh && ./scripts/perf/assert_budgets.sh` |

## Logs

- Directory: `docs/validation/metrics/golden-task-logs/`
