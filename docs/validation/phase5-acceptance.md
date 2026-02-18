# Phase 5 Acceptance (DirectStock)

Datum: 2026-02-14
Status: ACCEPTED

## Scope
1. Permission-basiertes RBAC
2. UI Preferences + Dashboard Konfiguration
3. Pricing
4. Sales Orders + Invoices + Delivery Note
5. E-Invoice Exportpfade (XRechnung/ZUGFeRD)
6. Hardening (Idempotency, Audit, Migrationen)

## Ausgefuehrte Verifikation

1. Backend Vollsuite
- Befehl: `cd backend && ./.venv/bin/python -m pytest -q`
- Ergebnis: `99 passed`

2. Backend Migrationssuite
- Befehl: `cd backend && ./.venv/bin/python -m pytest -q tests/test_migrations.py`
- Ergebnis: `1 passed`

3. Alembic Upgrade auf frischer DB
- Befehl: `cd backend && DATABASE_URL=sqlite:////tmp/directstock_phase5_mig.sqlite ./.venv/bin/alembic upgrade head`
- Ergebnis: erfolgreich bis `0023_invoice_exports`

4. Frontend Unit
- Befehl: `cd frontend && npm run test`
- Ergebnis: `9 passed`, `30 tests passed`

5. Frontend Build
- Befehl: `cd frontend && npm run build`
- Ergebnis: success

6. Frontend E2E Vollsuite (Desktop + iOS)
- Befehl: `cd frontend && npm run test:e2e`
- Ergebnis: `74 passed`, `4 skipped`
- Hinweis: die `4 skipped` sind erwartete projekt-/viewport-bedingte Skips in den Responsive- und Mobile-Readability-Specs.

7. Lighthouse/PWA
- Befehl: `npx --yes lighthouse@10 http://localhost:8080 --only-categories=pwa ...`
- Score-Pruefung: `node scripts/check_lighthouse_score.mjs artifacts/lighthouse/lighthouse.report.json 0.90`
- Ergebnis: `PWA score: 1 (threshold: 0.9)`

8. Production Smoke
- Stack: `docker compose -f docker-compose.prod.yml up -d --build`
- Endpunkte:
  - `GET /health -> 200`
  - `GET /api/health -> 200`
  - `GET /api/docs -> 200`
  - `POST /api/auth/login -> 200` (admin)

## Phase-5-spezifische Tests (neu)

Backend neu hinzugefuegt:
1. `backend/tests/test_rbac_permissions_phase5.py`
2. `backend/tests/test_ui_preferences_phase5.py`
3. `backend/tests/test_pricing_phase5.py`
4. `backend/tests/test_sales_orders_phase5.py`
5. `backend/tests/test_invoices_phase5.py`
6. `backend/tests/test_offline_idempotency_phase5.py`
7. E-Invoice-Schaerfungen in `backend/tests/test_invoices_phase5.py`:
   - strict KoSIT Success-Pfad (`generated`)
   - strict KoSIT Non-Zero-Exit (`validation_error`)
   - ZUGFeRD PDF/A-3 mit eingebettetem XML verifiziert

Frontend Unit neu hinzugefuegt:
1. `frontend/src/components/ProtectedRoute.test.ts`
2. `frontend/src/stores/uiPreferencesStore.test.ts`
3. `frontend/src/services/dashboardConfigApi.test.ts`
4. `frontend/src/services/pricingApi.test.ts`

Frontend E2E aktualisiert:
1. `frontend/tests/e2e/einvoice-export-flow.spec.ts` auf robustere Response-Validierung und eindeutige Marker fuer parallele Projekte.

## Bekannte Restpunkte
1. Keine offenen Restpunkte.

## Artefakte
1. `artifacts/lighthouse/lighthouse.report.json`
2. `artifacts/lighthouse/lighthouse.report.html`

## Erweiterung 2026-02-17 (Kundenhierarchie)
1. Backend-Zieltests:
   - Befehl: `cd backend && .venv/bin/python -m pytest -q tests/test_customers_hierarchy.py tests/test_customers.py tests/test_sales_orders_phase5.py tests/test_shipping_carriers.py`
   - Ergebnis: `8 passed`
2. Backend-Regressionsauszug:
   - Befehl: `cd backend && .venv/bin/python -m pytest -q tests/test_external_api_contract.py tests/test_invoices_phase5.py tests/test_offline_idempotency_phase5.py`
   - Ergebnis: `10 passed`
3. Frontend Build:
   - Befehl: `cd frontend && npm run build`
   - Ergebnis: success
4. Hinweis zu Frontend Unit:
   - Befehl: `cd frontend && npm run test`
   - Ergebnis: in dieser Umgebung `vitest` Worker-Timeouts beim Worker-Start (keine ausgefuehrten Tests).
5. Hinweis zu Alembic-SQLite-Einzellauf:
   - Befehl: `cd backend && DATABASE_URL=sqlite:////tmp/directstock_dbg.sqlite .venv/bin/alembic upgrade head`
   - Ergebnis: in dieser Umgebung haengend ohne Abschluss (separat zu untersuchen).

## Erweiterung 2026-02-17 (Services-Removal Breaking Change)
1. Service-Katalog entfernt:
   - `GET/POST/PUT/DELETE /api/services` entfaellt.
   - Frontend-Route `/services` entfaellt.
2. Sales-Order-Kontrakt reduziert auf Produktpositionen:
   - `service_id` entfaellt.
   - `item_type='service'` wird mit `422` abgelehnt.
3. Migration `0026_remove_services_domain` bereinigt vorhandene Service-Daten und entfernt die Services-Domaene strukturell.

## Erweiterung 2026-02-17 (Favicon + PWA/Homescreen-Branding)
1. Frontend-Branding vereinheitlicht:
   - Browser-Tab-Icons (`favicon-16.png`, `favicon-32.png`) und `apple-touch-icon.png` nutzen dasselbe Login-Logo wie `frontend/src/assets/logo.png`.
   - PWA-Manifest-Icons unter `frontend/public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png` wurden aus derselben Quelle neu erzeugt.
2. `frontend/index.html` ergaenzt um:
   - `<link rel="icon" ... /icons/favicon-32.png>`
   - `<link rel="icon" ... /icons/favicon-16.png>`
   - `<link rel="apple-touch-icon" ... /icons/apple-touch-icon.png>`
3. Austauschpfad fuer spaeteres High-Res-Logo:
   - Sobald ein hochaufgeloestes Brand-Asset vorliegt, werden exakt dieselben Ziel-Dateien in `frontend/public/icons/` erneut gerendert/ersetzt, ohne API- oder Typkontrakte zu aendern.
