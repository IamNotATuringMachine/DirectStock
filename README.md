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

Bereits umgesetzt im Frontend:

- Produktformular-Tabs für Lagerdaten und Lieferanten mit API-Anbindung
- Einkaufsseite (`/purchasing`) mit Bestellanlage, Positionspflege und Statusübergängen

Details und Task-Status:
- `directstock_phase2.md`

## Voraussetzungen

- Docker + Docker Compose
- Python 3.12+ (lokal für Backend-Tests/Skripte)
- Node.js 20+ (lokal für Frontend-Tests)

## Umgebungsvariablen

```bash
cp .env.example .env
```

Wichtige zusätzliche Variablen:

- `LEGACY_PRODUCTS_CSV_PATH`
- `LEGACY_IMPORT_BATCH_SIZE`
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

### Legacy current: Fail-fast Validation

```bash
python3 scripts/import_legacy_products.py --source "$LEGACY_PRODUCTS_CSV_PATH" --batch-size "$LEGACY_IMPORT_BATCH_SIZE" --dry-run
```

Hinweis: Der Importer validiert die CSV-Struktur strikt und bricht bei fehlenden Pflichtspalten mit Exit-Code `2` ab.

### Valid Fixture: Idempotent Upsert Apply

```bash
python3 scripts/import_legacy_products.py \
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
