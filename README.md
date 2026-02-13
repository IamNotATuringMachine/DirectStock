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

```bash
python3 scripts/import_legacy_products.py --source "$LEGACY_PRODUCTS_CSV_PATH" --batch-size "$LEGACY_IMPORT_BATCH_SIZE" --dry-run
```

Hinweis: Der Importer validiert die CSV-Struktur strikt und bricht bei fehlenden Pflichtspalten mit Exit-Code `2` ab.

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

## PWA Verifikationscheckliste

1. `http://localhost:8080/manifest.webmanifest` liefert Manifest.
2. Service Worker ist registriert (Browser DevTools Application/Service Workers).
3. Offline-Indikator im Header reagiert auf Netzwechsel.
4. Update-Banner erscheint bei neuer Service-Worker-Version.
5. Offline-Fallback ist erreichbar (`/offline.html`).

## Default Admin

- Username: `admin` (oder `DIRECTSTOCK_ADMIN_USERNAME`)
- Passwort: `DIRECTSTOCK_ADMIN_PASSWORD`
