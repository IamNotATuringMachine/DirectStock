# Phase 4 Acceptance - DirectStock

Datum: 2026-02-13  
Zeitzone: UTC  
Status: PASS

## Scope
Validierung von Phase-4 Features:

1. External API v1 + Integration Clients
2. Legacy Migration Full Pipeline
3. Shipping (DHL/DPD/UPS) inkl. Webhooks
4. Inter-Warehouse Transfers
5. Trends + Demand Forecast

## Verifikationsläufe

1. Backend-Testlauf

```bash
cd /Users/tobiasmorixbauer/Documents/GitHub/DirectStock/backend && ./.venv/bin/python -m pytest -q
```

Ergebnis: `76 passed in 37.57s`

2. Frontend Unit

```bash
cd /Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend && npm run test
```

Ergebnis: `13 passed`

3. Frontend Build

```bash
cd /Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend && npm run build
```

Ergebnis: `tsc --noEmit` + Vite Build erfolgreich

4. Frontend E2E

```bash
cd /Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend && npm run test:e2e
```

Ergebnis: `16 passed`

5. Lighthouse/PWA

```bash
cd /Users/tobiasmorixbauer/Documents/GitHub/DirectStock && ./scripts/lighthouse_pwa.sh
```

Ergebnis: `PWA score: 1` (Threshold `0.9`)  
Artefakte:

- `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/artifacts/lighthouse/lighthouse.report.json`
- `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/artifacts/lighthouse/lighthouse.report.html`

6. Legacy Full Migration Dry-Run (Container-runtime)

```bash
cd /Users/tobiasmorixbauer/Documents/GitHub/DirectStock && docker compose exec -T backend python /app/scripts/migrate_legacy_full.py --mode dry-run --domain all --source /app/backend/tests/fixtures/legacy_full
```

Ergebnis: Erfolg für alle Domains (`master`, `transactions`, `organization`, `support`), keine Fehler und keine Placeholder-Domains.

Zusatzcheck Vollständigkeit:
- Dry-Run mit zusätzlicher Legacy-CSV (`app_vars.csv`) im Source-Ordner ergibt `domain=support processed=4` (typed + raw staging), `errors=0`.

7. Demand Forecast Batch

```bash
cd /Users/tobiasmorixbauer/Documents/GitHub/DirectStock && docker compose exec -T backend python /app/scripts/run_demand_forecast.py
```

Ergebnis: `Demand forecast completed run_id=7 ... items=13`

8. Runtime Smoke

- `GET /health` -> `{"status":"ok"}`
- `GET /api/health` -> `{"status":"ok"}`
- `GET /api/docs` -> HTTP `200`
- External API Smoke:
  - Integration Client erzeugt
  - `POST /api/external/token` erfolgreich
  - `GET /api/external/v1/products` erfolgreich (`100` Einträge)
  - `GET /api/external/v1/warehouses` erfolgreich (`50` Einträge)

## Abweichungen/Anmerkungen

1. Der Standardpfad aus `.env` für `LEGACY_PRODUCTS_CSV_PATH` war im Container nicht gemountet; deshalb wurde für den reproduzierbaren Dry-Run das Test-Fixture als `--source` verwendet.
2. Nach dem Lighthouse-Prodlauf wurde der Dev-`frontend`-Container neu gebaut, da das Prod-Build das getaggte Frontend-Image überschrieben hatte.

## Fazit

Phase 4 ist funktional und testseitig abgenommen.  
Alle kritischen Verifikationen (Backend, Frontend Unit/E2E, Lighthouse, Migration Dry-Run, Forecast Batch, Runtime-Smoke) sind erfolgreich durchgelaufen.
