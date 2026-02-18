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
4. Vor Merge: lint, tests, build, smoke.

## Command Matrix
```bash
# Frontend
cd frontend && npm run lint
cd frontend && npm run format:check
cd frontend && npm run test
cd frontend && npm run build

# Backend
cd backend && ruff check --config ruff.toml app/routers/operations app/routers/reports app/services/operations app/services/reports app/bootstrap.py tests/test_seed.py
cd backend && ruff format --config ruff.toml --check app/routers/operations app/routers/reports app/services/operations app/services/reports app/bootstrap.py tests/test_seed.py
cd backend && python -m pytest -q

# Repo
pre-commit run --all-files
```
