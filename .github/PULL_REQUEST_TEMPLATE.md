## Summary

## Scope Allowlist Check
- [ ] Änderungen liegen innerhalb der Refactor-Allowlist aus `docs/guides/refactor-scope-allowlist.md`.
- [ ] Falls nein: Out-of-scope Ausnahme unten dokumentiert.

## Out-of-scope Ausnahme
- Datei:
- Begründung:

## Validation
- [ ] Frontend: `npm run lint`
- [ ] Frontend: `npm run format:check`
- [ ] Frontend: `npm run test -- --run`
- [ ] Frontend: `npm run build`
- [ ] Backend: `ruff check` (Refactor Scope)
- [ ] Backend: `ruff format --check` (Refactor Scope)
- [ ] Backend: `./scripts/run_backend_pytest.sh -q`
- [ ] Repo: `pre-commit run --all-files`

## Risiko/Regression
- [ ] Keine API-Path-Breaks
- [ ] `ApiError`-Format unverändert
- [ ] `X-Client-Operation-Id` Verhalten unverändert
