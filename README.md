# DirectStock Sprint 1 Foundation

Dieses Repository enthält die Sprint-1-Implementierung für DirectStock inkl. Phase `1.11.1-1.11.5`:

- Infrastruktur mit Docker Compose (`postgres`, `backend`, `frontend`, `nginx`)
- FastAPI-Backend mit Alembic-Migrationen
- Authentifizierung (JWT), RBAC und Benutzerverwaltung
- Audit-Logging, Request-ID und standardisierte Fehlerantworten
- Frontend-Scaffold mit React/Vite, PWA-Manifest + Service Worker + Offline-UI
- Deterministischer Seed auf MVP-Niveau und Legacy-Importer (Fail-fast CSV-Validierung)
- Backend-Tests, Frontend-Unit-Tests und Playwright-E2E-Basissuite
- Separate Production-Runtime-Artefakte

## Phase-2 Snapshot (aktueller Umsetzungsstand)

Bereits umgesetzt im Backend:

- Kundenstamm-API (`/api/customers`)
- Lieferantenstamm-API inkl. Produktzuordnung (`/api/suppliers`, `/api/products/{id}/suppliers`)
- Produkt-Lagerdaten-API (`/api/products/{id}/warehouse-settings/{warehouse_id}`)
- Einkaufsmodul-Basis (`/api/purchase-orders` + Items + Status-Workflow)
- Erweiterung Warenausgang um optionale Kundenreferenz via `customer_id`
- Alerting (`/api/alert-rules`, `/api/alerts`, Ack-Flow) inkl. Triggern auf Bestandsänderungen
- Idempotency-Schutz für Offline-relevante Mutationen über `X-Client-Operation-Id` mit Replay und Konfliktantworten
- Erweiterte RBAC-Rollenbasis (`einkauf`, `versand`, `controller`) inkl. serverseitiger Rechte-Matrix für Phase-2-Module

Bereits umgesetzt im Frontend:

- Produktformular-Tabs für Lagerdaten und Lieferanten mit API-Anbindung
- Einkaufsseite (`/purchasing`) mit Bestellanlage, Positionspflege und Statusübergängen
- Alerts-Seite (`/alerts`) mit Filter- und Ack-Workflow sowie Dashboard-Widget für kritische Alerts
- Offline-Queue-Engine fuer WE/WA/Umlagerung/Inventur inkl. globalem Sync-Panel (Queue, Retry, Discard, Auto-Sync bei Reconnect)

Details und Task-Status:
- `directstock_phase2.md`
- `docs/validation/phase2-acceptance.md`

## Phase-3 Snapshot (aktueller Umsetzungsstand)

Neu ergänzt (additiv, umgesetzt):

- Datenmodell-Foundation für Phase 3 (ABC, Bestellvorschläge, Picking, Retouren, Approval, Dokumente, Audit-v2)
- Neue APIs:
  - `/api/abc-classifications`
  - `/api/purchase-recommendations`
  - `/api/pick-waves`, `/api/pick-tasks`
  - `/api/return-orders`
  - `/api/approval-rules`, `/api/approvals`
  - `/api/documents`
  - `/api/audit-log`
- Reports-Erweiterungen:
  - `/api/reports/returns`
  - `/api/reports/picking-performance`
  - `/api/reports/purchase-recommendations`
  - Erweiterte KPI-Felder in `/api/reports/kpis`
- Frontend-Erweiterungen:
  - Neue Seiten `Picking`, `Returns`, `Approvals`, `Documents`, `Audit Trail`
  - `PurchasingPage` um Tabs `ABC` und `Bestellvorschläge` erweitert
  - Rolle `auditor` im Frontend-Role-Typ ergänzt
- E2E-Verifikation um Phase-3-Flows erweitert:
  - `picking-wave-flow.spec.ts`
  - `returns-flow.spec.ts`
  - `approvals-flow.spec.ts`
  - `documents-attachment-flow.spec.ts`
  - `audit-log-visibility.spec.ts`

Details und Task-Status:
- `directstock_phase3.md`
- `docs/validation/phase3-acceptance.md`

## Phase-4 Snapshot (aktueller Umsetzungsstand)

Neu ergänzt (additiv, umgesetzt):

- Externe Integrations-API v1:
  - Token-Flow: `/api/external/token`
  - Read Contracts: `/api/external/v1/products`, `/warehouses`, `/inventory`, `/movements`, `/shipments`
  - Write Contracts: `/api/external/v1/commands/purchase-orders`, `/commands/goods-issues`
  - Integration-Client-Management: `/api/integration-clients`
- Legacy Migration v2:
  - Vollimport-Orchestrierung: `scripts/migrate_legacy_full.py` (`dry-run|apply|delta`)
  - Tracking-Tabellen für Runs/Issues/ID-Mapping
- Shipping v1:
  - APIs: `/api/shipments`, `/api/shipments/{id}/create-label`, `/tracking`, `/cancel`
  - Carrier-Webhooks: `/api/carriers/{carrier}/webhook`
  - Adapterstruktur für DHL/DPD/UPS
- Inter-Warehouse Transfers:
  - APIs: `/api/inter-warehouse-transfers`, `/items`, `/dispatch`, `/receive`, `/cancel`
  - State Machine: `draft -> dispatched -> received`, `draft -> cancelled`
- Reports-Erweiterung:
  - `/api/reports/trends`
  - `/api/reports/demand-forecast`
  - `/api/reports/demand-forecast/recompute`
- Frontend-Erweiterungen:
  - Neue Seiten: `/shipping`, `/inter-warehouse-transfer`
  - `ReportsPage` um `trends` + `demand-forecast` inkl. CSV und Forecast-Recompute erweitert
- E2E-Verifikation um Phase-4-Flows erweitert:
  - `shipping-flow.spec.ts`
  - `inter-warehouse-transfer-flow.spec.ts`
  - `reports-forecast-flow.spec.ts`

Details und Task-Status:
- `directstock_phase4.md`
- `docs/validation/phase4-acceptance.md`
- `docs/validation/phase4-migration-rehearsal.md`

## Voraussetzungen

- Docker + Docker Compose
- Python 3.12+ (lokal für Backend-Tests/Skripte)
- Node.js 20+ (lokal für Frontend-Tests)

## Umgebungsvariablen

```bash
cp .env.example .env
```

Wichtige zusätzliche Variablen:

- `SEED_ON_START` (nur Prod-Compose, optional)

## Starten (Dev/Default Stack)

```bash
docker compose up --build
```

Danach verfügbar:

- App Entry: `http://localhost:8080`
- API Docs: `http://localhost:8080/api/docs`
- Health: `http://localhost:8080/health`

## Entwicklungsmodus (Hot Reload)

```bash
docker compose -f docker-compose.dev.yml up --build
```

## Production Stack

```bash
docker compose -f docker-compose.prod.yml up --build
```

Optional Seed für lokale Prod-Verifikation:

```bash
SEED_ON_START=true docker compose -f docker-compose.prod.yml up --build
```

## Seed und Legacy-Import

```bash
python3 scripts/seed_data.py --mode mvp
python3 scripts/seed_data.py --mode auth
```

### Legacy Full Migration (Phase 4)

```bash
python3 scripts/migrate_legacy_full.py \
  --mode dry-run \
  --domain all \
  --source backend/tests/fixtures/legacy_full
```

Modi:
- `--mode dry-run`: nur Validierung/Reconciliation ohne Persistenz
- `--mode apply`: persistenter Vollimport
- `--mode delta --since <ISO-UTC>`: inkrementeller Lauf

Hinweis: Der Import validiert Vertragsdateien fail-fast (Exit-Code `2`) und übernimmt zusätzlich alle nicht gemappten Legacy-CSV-Tabellen in `legacy_raw_records`.

### Valid Fixture: Idempotent Apply

```bash
python3 scripts/migrate_legacy_full.py \
  --mode apply \
  --domain master \
  --source backend/tests/fixtures/legacy_products_valid.csv \
  --batch-size 2
```

Erwartung:
- erster Lauf: `created > 0`
- zweiter Lauf mit gleicher Datei: `created=0`, `updated=0`

## Testen

Backend:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e .[dev]
python -m pytest
```

Frontend Unit:

```bash
cd frontend
npm install
npm run test
```

Frontend E2E (gegen laufenden Stack auf `http://localhost:8080`):

```bash
cd frontend
npx playwright install
npm run test:e2e
```

## Prod Verification Checklist

1. Prod-Stack starten:

```bash
docker compose -f docker-compose.prod.yml up --build
```

2. Endpunkte pruefen:
- `http://localhost:8080/health`
- `http://localhost:8080/api/health`
- `http://localhost:8080/api/docs`

3. Login-Smoketest mit Default-Admin.

4. Lighthouse PWA Audit (automatisiert, Score >= 0.90):

```bash
./scripts/lighthouse_pwa.sh
```

Artefakte:
- `artifacts/lighthouse/lighthouse.report.json`
- `artifacts/lighthouse/lighthouse.report.html`

5. Scanner-Dokumentationsnachweis:
- `docs/validation/scanner-verification.md`

## PWA Verifikationscheckliste

1. `http://localhost:8080/manifest.webmanifest` liefert Manifest.
2. Service Worker ist registriert (Browser DevTools Application/Service Workers).
3. Offline-Indikator im Header reagiert auf Netzwechsel.
4. Update-Banner erscheint bei neuer Service-Worker-Version.
5. Offline-Fallback ist erreichbar (`/offline.html`).

## Default Admin

- Username: `admin` (oder `DIRECTSTOCK_ADMIN_USERNAME`)
- Passwort: `DIRECTSTOCK_ADMIN_PASSWORD`
