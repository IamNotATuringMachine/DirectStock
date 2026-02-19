# DirectStock Platform (Phase 5+)

Dieses Repository enthält den aktuellen produktionsnahen Stand von DirectStock (Backend + Frontend + Governance).
Die ursprüngliche Sprint-1-Basis ist vollständig erweitert bis einschließlich Phase 5 mit zusätzlichen Governance-/Autonomy-Gates für LLM-gestützte Entwicklung.

Aktuelle Plattform-Bausteine:

- Infrastruktur mit Docker Compose (`postgres`, `backend`, `frontend`, `nginx`)
- FastAPI-Backend mit Alembic-Migrationen
- Authentifizierung (JWT), RBAC und Benutzerverwaltung
- Audit-Logging, Request-ID und standardisierte Fehlerantworten
- Lagerplatz-QR-Labels mit lesbarem Platznamen unter dem QR-Code (PNG/PDF)
- Frontend-Scaffold mit React/Vite, PWA-Manifest + Service Worker + Offline-UI
- Deterministischer Seed auf MVP-Niveau und Legacy-Importer (Fail-fast CSV-Validierung)
- Backend-Tests, Frontend-Unit-Tests und Playwright-E2E-Basissuite
- Separate Production-Runtime-Artefakte
- AGENTS-zentrierte Multi-Provider-Governance (OpenAI, Anthropic, Google)
- MCP-Profile für autonome Entwicklung, CI-Read-only und Governance-Reviews

## AI Agent Instructions

- Canonical policy: `AGENTS.md`
- Scoped deltas: `backend/AGENTS.md`, `frontend/AGENTS.md`
- Tool adapters: `CLAUDE.md`, `GEMINI.md`, `CODEX.md`
- Provider profiles: `docs/agents/providers/*`
- Policy contract: `docs/agents/policy.contract.yaml`
- Setup guide: `docs/guides/ai-agent-setup.md`
- MCP strategy: `docs/guides/mcp-stack-strategy.md`
- Gemini + Antigravity setup: `docs/guides/gemini-antigravity-setup.md`
- Handoff protocol: `docs/agents/handoff-protocol.md`

Arbeitsmodus: production-only. Relevante Tests muessen vor Abschluss ausgefuehrt und berichtet werden.

## Ralph Loop CLI (`direct ralph`)

Ralph ist ein iterativer Agent-Loop mit hartem Context-Reset pro Iteration. Das Tool lebt in `scripts/ralph/`.

Installation:

```bash
cd scripts/ralph
npm ci
npm run build
npm link
```

Beispiele:

```bash
# interaktiv
direct ralph

# vorhandenen Plan verwenden
direct ralph --plan ./ralph-plan.json --max-iterations 10 --no-preset

# Preview ohne Mutationen (kein Commit, kein Plan-Status-Write)
direct ralph --plan ./ralph-plan.json --dry-run

# Session-Continuation für lange Läufe
direct ralph --plan ./ralph-plan.json --session-strategy resume

# Post-Checks am Ende steuern
direct ralph --plan ./ralph-plan.json --post-check-profile governance

# JSONL Event-Output in Konsole + Datei
direct ralph --plan ./ralph-plan.json --log-format jsonl

# Provider-Capability-Mismatch als hard fail
direct ralph --plan ./ralph-plan.json --strict-provider-capabilities

# Template ausgeben
direct ralph --plan-template
```

Hinweise:
- Bei mehreren Plan-Dateien im Repo-Root fragt der interaktive Flow nach der gewünschten Datei (z. B. `frontend_plan.json` oder `backend_plan.json`).
- `--session-strategy resume` persistiert die letzte Provider-Session-ID im Plan (`metadata.resumeSessionId`) und setzt sie nach Neustart fort.

Wichtige Flags:
- `--no-preset`
- `--dry-run`
- `--no-auto-commit`
- `--allow-dirty`
- `--max-iterations <n>`
- `--plan <path>`
- `--session-strategy <reset|resume>`
- `--post-check-profile <none|fast|governance|full>`
- `--log-format <text|jsonl>`
- `--run-log-path <path>`
- `--strict-provider-capabilities`
- `--plan-template`

Run-Log:
- Standardpfad: `.ralph/runs/<timestamp>.jsonl`
- Enthält strukturierte Events (`run_started`, `iteration_started`, `provider_retry`, `step_done`, `post_check_failed`, `run_finished`)

Plan-Referenzen:
- Template: `docs/guides/ralph-plan-template.md`
- JSON-Schema: `docs/contracts/ralph-plan.schema.json`

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

- Produktformular als Wizard für Neuanlage plus Tabs im Bearbeiten (Lagerdaten/Lieferanten/Preise) mit API-Anbindung
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
  - Adapterstruktur für DHL/DHL Express (MyDHL API `3.2.0`)/DPD/UPS
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

## Phase-5 Snapshot (aktueller Umsetzungsstand)

Neu ergänzt (additiv, umgesetzt):

- Permission-basiertes RBAC als technische Source-of-Truth:
  - `GET /api/auth/me` liefert additiv `permissions: string[]`
  - neue Router: `/api/permissions`, `/api/pages`, `/api/roles`
  - neue Dependency `require_permissions(...)` in Phase-5-Routern
  - benutzerzentrierte Access-Profile:
    - `GET /api/users?managed_only=true`
    - `GET /api/users/{user_id}/access-profile`
    - `PUT /api/users/{user_id}/access-profile`
    - effektive Rechte: `(role_permissions - deny_permissions) U allow_permissions`
- UI Preferences + Dashboard-Konfiguration:
  - `/api/ui-preferences/me`
  - `/api/dashboard/cards/catalog`
  - `/api/dashboard/config/me`
  - `/api/dashboard/config/roles/{role_id}`
- Pricing:
  - `/api/pricing/*` (Basispreise, Kundenpreise, Preisauflösung)
- Kundenhierarchie:
  - `/api/customers/{customer_id}/locations`
  - `/api/customers/{customer_id}/contacts`
  - optionale Standort-Verknüpfung in `/api/goods-issues`, `/api/sales-orders`, `/api/shipments`
- Sales + Invoices:
  - `/api/sales-orders`
  - `/api/invoices`
  - `/api/sales-orders/{id}/delivery-note` (GoodsIssue-basierte Lieferscheinerzeugung)
- E-Invoice Exportpfade:
  - `/api/invoices/{id}/exports/xrechnung`
  - `/api/invoices/{id}/exports/zugferd`
  - Export-Tracking in `invoice_exports`
- Frontend:
  - Permission-Guards in Routing/Navigation
  - neue Seiten `/sales-orders`, `/invoices`, `/customers`
  - Theme-Persistenz und Dashboard-Customizing

Phase-5-Validierung (Stand 2026-02-14):
- Backend: `95 passed`
- Frontend Unit: `30 passed`
- Frontend E2E Volllauf: `74 passed`, `4 skipped`
- Lighthouse/PWA: `1.00`
- Prod Smoke: `/health`, `/api/health`, `/api/docs`, Login erfolgreich

Details und Nachweise:
- `directstock_phase5.md`
- `docs/validation/phase5-acceptance.md`

## Voraussetzungen

- Docker + Docker Compose
- Python 3.12+ (lokal für Backend-Tests/Skripte)
- Node.js 20+ (lokal für Frontend-Tests)

## Umgebungsvariablen

```bash
cp .env.example .env
```

Wichtige zusätzliche Variablen:

- `SEED_ON_START` (optional, Standard `false`; gilt für Default/Dev/Prod-Stack)
- `EINVOICE_EN16931_VALIDATION_MODE` (`strict` oder `builtin_fallback`, Default: `strict`)
- `EINVOICE_KOSIT_VALIDATOR_JAR` (Pfad zur KoSIT-Validator-JAR)
- `EINVOICE_KOSIT_SCENARIO` (Pfad zur KoSIT-Szenario-Datei)

## Clean-Slate DB Umstellung (neue DB, alte DB bleibt erhalten)

Der Standard ist auf `directstock_clean` umgestellt. Bestehende alte Docker-Volumes werden absichtlich nicht gelöscht und nicht mehr aktiv genutzt.

Einmaliger Umstieg für lokale Umgebungen mit bestehender DB:

```bash
docker compose down
docker compose -f docker-compose.dev.yml down
```

Danach in `.env` sicherstellen:

- `POSTGRES_DB=directstock_clean`
- `DATABASE_URL=postgresql+psycopg://directstock:directstock@postgres:5432/directstock_clean`
- `ASYNC_DATABASE_URL=postgresql+asyncpg://directstock:directstock@postgres:5432/directstock_clean`

Dann Stack neu starten:

```bash
docker compose up --build
```

Erwartung: neue `*_clean_*` Volumes werden angelegt, alte Volumes bleiben parallel vorhanden.

## Starten (Default Stack mit Frontend-Live-Reload)

```bash
docker compose up --build
```

Der Default-Stack mountet `./frontend` in den Frontend-Container. Damit liefert `http://localhost:8080` immer den aktuellen lokalen Frontend-Stand ohne manuelles Rebuild bei jeder UI-Aenderung.

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

Optionaler Seed für Default/Dev/Prod-Stack:

```bash
SEED_ON_START=true docker compose up --build
SEED_ON_START=true docker compose -f docker-compose.dev.yml up --build
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
ruff check --config ruff.toml app/routers/operations app/routers/reports app/services/operations app/services/reports app/bootstrap.py tests/test_seed.py
ruff format --config ruff.toml --check app/routers/operations app/routers/reports app/services/operations app/services/reports app/bootstrap.py tests/test_seed.py
python -m pytest -q
```

Frontend Unit:

```bash
cd frontend
npm install
npm run test:e2e:hermetic
npm run lint
npm run format:check
npm run test
```

Frontend E2E (isolierter Standardlauf mit eigenem Compose-Project + automatischem `down -v`):

```bash
cd frontend
npx playwright install
npm run test:e2e
```

Frontend E2E Smoke (isoliert, Desktop + Mobile):

```bash
cd frontend
npm run test:e2e:smoke
```

Frontend E2E Raw (gegen bereits laufenden Stack, z. B. `http://localhost:8080`):

```bash
cd frontend
npm run test:e2e:raw
```

One-time Cleanup fuer bereits bestehende E2E/Testdaten:

```bash
python3 scripts/cleanup_test_data.py --mode dry-run
python3 scripts/cleanup_test_data.py --mode apply
```

Repository-Gates (optional, empfohlen vor PR):

```bash
pre-commit run --all-files
./scripts/autonomous_task_harness.sh
```

Refactor-Review-Hilfen:
- Scope-Allowlist: `docs/guides/refactor-scope-allowlist.md`
- Vibe-Playbook: `docs/guides/vibe-coding-playbook.md`
- Modulkarte: `docs/guides/module-map.md`

## Prod Verification Checklist

1. Prod-Stack starten:

```bash
docker compose -f docker-compose.prod.yml up --build
```

2. Endpunkte pruefen:
- `http://localhost:8080/health`
- `http://localhost:8080/api/health`
- `http://localhost:8080/api/docs`

3. Login-Smoketest nur bei aktiviertem Seed (`SEED_ON_START=true`).

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

Nur vorhanden, wenn Seed aktiviert wurde (`SEED_ON_START=true` oder manuell `python3 scripts/seed_data.py --mode mvp`).

- Username: `admin` (oder `DIRECTSTOCK_ADMIN_USERNAME`)
- Passwort: `DIRECTSTOCK_ADMIN_PASSWORD`
