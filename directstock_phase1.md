## DirectStock Phase 1 - Umsetzungsstatus (Hard Abnahme)

Stand: **13. Februar 2026**
Gesamtstatus: **PARTIAL**

### Legende
- `DONE`: vollständig umgesetzt und verifiziert
- `PARTIAL`: umgesetzt, aber mit klaren Restlücken
- `OPEN`: noch nicht umgesetzt

### Verifikationsstand (zuletzt ausgeführt am 13. Februar 2026)
- `backend`: `pytest` grün (`23 passed`)
- `frontend unit`: `vitest` grün (`9 passed`)
- `frontend e2e`: `playwright` grün (`3 passed`)
- `build`: `vite build` inkl. PWA erfolgreich
- `runtime smoke`: `/health`, `/api/health`, `/api/docs` jeweils `200` im Compose-Stack

### Task-Statusmatrix 1.0-1.11

| Task | Status | Kurzbegründung |
|---|---|---|
| 1.0.1 Repository + Docker-Infrastruktur | DONE | Monorepo, Compose-Dateien, Basisstruktur vorhanden |
| 1.0.2 Backend-Projekt | DONE | FastAPI/SQLAlchemy/Alembic Grundgerüst inkl. Health, Config, DB |
| 1.0.3 Frontend-Projekt | DONE | React/Vite/Tailwind/shadcn Basis inklusive Routing/Test-Setup |
| 1.0.4 Nginx + Docker-Validierung | DONE | Routing `/api/*` + `/`, Health erfolgreich validiert |
| 1.1.1 Modelle + Alembic | DONE | Phase-1 Schema + Migrationen + Migrationstest grün |
| 1.1.2 Auth + Benutzerverwaltung | DONE | Login/Refresh/Logout/Me + User-CRUD + RBAC vorhanden |
| 1.1.3 Audit + Fehlerhandling | DONE | Audit-Middleware, Request-ID, standardisierte Fehlerantworten |
| 1.2.1 App-Shell + Routing + Layout | PARTIAL | Routing/Navigation vorhanden, Sidebar nicht einklappbar (280/72) |
| 1.2.2 Auth-Integration Frontend | DONE | Auth-Store, API-Interceptor, Protected Routes, Login-Flow vorhanden |
| 1.3.1 Backend Artikelstamm-API | DONE | Produkt-CRUD + Suche/Filter + QR/EAN + Gruppen-API vorhanden |
| 1.3.2 Frontend Artikelstamm-UI | PARTIAL | Produktseite vorhanden, aber keine separaten ProductFormPage/ProductDetailPage |
| 1.4.1 Backend Lagerstruktur-API | DONE | Warehouse/Zone/Bin-CRUD, Batch, QR-Lookup, PNG/PDF-QR vorhanden |
| 1.4.2 Frontend Lagerstruktur-UI | PARTIAL | Funktionale UI vorhanden, aber keine separaten Grid/Dialog-Komponenten |
| 1.5.1 Universelle Scanner-Komponente | DONE | Kamera + externer Scanner + Feedback + Parsing + ScannerPage umgesetzt |
| 1.6.1 Backend Wareneingang-API | DONE | CRUD + Complete + Cancel mit Bestandsbuchung |
| 1.6.2 Frontend Wareneingang-Workflow | DONE | Schrittworkflow Scan->Menge->Bin->Bestätigen inkl. Progress |
| 1.7.1 Backend Bestands-API | DONE | Aggregiert, by-product/by-bin/by-warehouse, low-stock, movements, summary |
| 1.7.2 Frontend Bestandsübersicht-UI | PARTIAL | Tabelle/Low-stock/Movements/Refresh vorhanden, Detail-Sheet fehlt |
| 1.8.1 Backend Warenausgang-API | DONE | Analog WE inkl. Bestandsprüfung und Buchung |
| 1.8.2 Frontend Warenausgang-Workflow | DONE | Scan-Flow umgesetzt inkl. Restbestandswarnung |
| 1.9.1 Backend Umlagerungs-API | DONE | Atomare Umbuchung Quelle->Ziel implementiert |
| 1.9.2 Frontend Umlagerungs-UI | DONE | 5-Schritt-Workflow umgesetzt |
| 1.10.1 Backend Dashboard-API | DONE | Summary, recent, low-stock, activity-today vorhanden |
| 1.10.2 Frontend Dashboard-UI | PARTIAL | KPI/Quick-Actions/Listen vorhanden, KPI "Auslastung" fehlt |
| 1.11.1 PWA-Konfiguration | DONE | Manifest, SW, Offline/Install/Update-UI vorhanden |
| 1.11.2 Seed + Legacy-Import | PARTIAL | Deterministischer Seed vorhanden; Importer fail-fast validiert, kein produktiver Legacy-Importlauf |
| 1.11.3 Backend-Tests | DONE | Auth/Product/Warehouse/Inventory/Operations/Audit/Migration/Seed/Import validiert |
| 1.11.4 Frontend-Tests | DONE | Unit + 3 kritische E2E-Flows grün |
| 1.11.5 Production-Build + Deployment-Test | PARTIAL | Prod-Artefakte + Compose vorhanden; Lighthouse>90/Tablet-Scanner nicht nachgewiesen |

### Harte Restlücken fuer "Phase 1 komplett"
- `1.2.1`: Sidebar-Collapse (280px -> 72px) fertigstellen.
- `1.3.2`: Separate `ProductFormPage` und `ProductDetailPage` implementieren.
- `1.4.2`: Warehouse-UI in dedizierte Komponenten (`BinLocationGrid`, `QRPrintDialog`, `BinBatchCreateDialog`) aufteilen.
- `1.7.2`: Produkt-Detail-Sheet mit Bestand pro Bin + letzte 10 Bewegungen ergänzen.
- `1.10.2`: Dashboard-KPI "Auslastung" ergänzen.
- `1.11.2`: Legacy-Import gegen fachlich valides Quellformat produktiv durchlaufen lassen.
- `1.11.5`: Lighthouse-PWA-Score > 90 + manueller Tablet-Scanner-Nachweis dokumentieren.

Verstanden - im Plan-Modus darf ich nur die Plan-Datei bearbeiten. Sobald der Plan
  genehmigt wird, schreibe ich ihn sofort in directstock_phase1.md. Der vollständige Plan
  steht bereit.

⏺ User approved Claude's plan
  ⎿  Plan saved to: ~/.claude/plans/jaunty-snacking-donut.md · /plan to edit
     DirectStock Phase 1 (MVP) – Detaillierter Implementierungsplan

     Context

     DirectStock ist eine Lagerverwaltungs-PWA basierend auf dem Masterplan in
     directstock.md. Phase 1 (MVP) umfasst die 10 Kernfunktionen: Artikelstamm,
     Lagerstruktur, QR-Scanning, Wareneingang/-ausgang, Bestandsübersicht, Umlagerung,
     Dashboard, Benutzerverwaltung und PWA-Grundfunktionalität.

     Die bestehende Infrastruktur im LLMRAG-Projekt liefert: PostgreSQL-Schema-Entwurf
     (MODERN_SCHEMA_PROPOSAL.sql), Feld-Mapping (MIGRATION_MAPPING.md), CSV-Daten
     (73.596 Produkte, 4.851 Kunden, 309 Lieferanten) und Docker-Erfahrung.

     Ziel: Nach Abschluss läuft ein funktionsfähiges WMS als PWA auf Tablets mit
     QR-Scan-Support.

     Ausgabe: Plan wird nach Genehmigung in directstock_phase1.md geschrieben.

     ---
     Tech-Stack-Entscheidungen

     Bereich: Frontend
     Entscheidung: React 19 + Vite 6
     Begründung: Größtes Ökosystem für PWA, beste Scanner-Lib-Unterstützung, kein SSR
     nötig
       (reine SPA/PWA)
     ────────────────────────────────────────
     Bereich: UI-Library
     Entscheidung: shadcn/ui + Radix
     Begründung: Headless + Tailwind = volle Anpassbarkeit für Tablet-Touch-Targets,
     kein
       Vendor-Lock-in
     ────────────────────────────────────────
     Bereich: State
     Entscheidung: Zustand + TanStack Query v5
     Begründung: Zustand für Client-State (Scanner, UI), TanStack Query für Server-State
      mit
       Caching + Offline
     ────────────────────────────────────────
     Bereich: Scanner
     Entscheidung: html5-qrcode v2.3
     Begründung: Einzige Lib die Kamera + externe Scanner zuverlässig unterstützt, aktiv

       maintained
     ────────────────────────────────────────
     Bereich: Backend
     Entscheidung: FastAPI (Python 3.12)
     Begründung: Bereits in LLMRAG genutzt, async, auto OpenAPI-Doku,
     Pydantic-Validierung
     ────────────────────────────────────────
     Bereich: ORM
     Entscheidung: SQLAlchemy 2.0 + Alembic
     Begründung: Standard für FastAPI + PostgreSQL, deklarativer Mapped-Column-Stil
     ────────────────────────────────────────
     Bereich: Datenbank
     Entscheidung: PostgreSQL 16
     Begründung: Robuste ACID-DB, JSONB für Audit-Log, bestehender Schema-Entwurf
     vorhanden
     ────────────────────────────────────────
     Bereich: Auth
     Entscheidung: JWT (python-jose + passlib)
     Begründung: Stateless ideal für PWA + Offline, Access-Token 15min + Refresh-Token
     7d
     ────────────────────────────────────────
     Bereich: PWA
     Entscheidung: vite-plugin-pwa (Workbox)
     Begründung: Nahtlose Vite-Integration, Workbox-Strategien für Offline-Caching
     ────────────────────────────────────────
     Bereich: CSS
     Entscheidung: Tailwind CSS v4
     Begründung: Voraussetzung für shadcn/ui, Utility-first ideal für schnelle Tablet-UI
     ────────────────────────────────────────
     Bereich: Testing
     Entscheidung: Vitest + Playwright + pytest
     Begründung: Frontend-Unit/E2E + Backend-API-Tests
     ────────────────────────────────────────
     Bereich: API
     Entscheidung: REST + OpenAPI 3.1
     Begründung: FastAPI generiert automatisch Specs, einfacher zu debuggen als GraphQL
     ────────────────────────────────────────
     Bereich: Projekt
     Entscheidung: Monorepo (1 Repo, /frontend + /backend)
     Begründung: Einfach, shared docker-compose, kein Monorepo-Tooling nötig

     ---
     Projektstruktur

     DirectStock/
     ├── docker-compose.yml / docker-compose.dev.yml
     ├── .env.example / .gitignore
     ├── directstock.md / directstock_phase1.md
     ├── backend/
     │   ├── Dockerfile / pyproject.toml / alembic.ini
     │   ├── alembic/env.py + versions/
     │   └── app/
     │       ├── main.py / config.py / database.py / dependencies.py
     │       ├── models/    (user, product, warehouse, inventory, audit)
     │       ├── schemas/   (user, product, warehouse, inventory)
     │       ├── routers/   (auth, users, products, warehouses, inventory,
     goods_receipt, goods_issue, stock_transfer, dashboard)
     │       ├── services/  (auth, product, warehouse, inventory, goods_issue,
     stock_transfer, qr)
     │       ├── middleware/ (audit, error_handler)
     │       └── utils/     (security, qr_generator)
     ├── frontend/
     │   ├── Dockerfile / package.json / vite.config.ts / tsconfig.json
     │   └── src/
     │       ├── components/ (ui/, layout/, scanner/, products/, warehouse/, inventory/,
      goods-receipt/, goods-issue/, stock-transfer/, dashboard/, pwa/, auth/)
     │       ├── pages/ hooks/ stores/ services/ types/ lib/
     ├── nginx/nginx.conf
     └── scripts/ (seed_data.py, import_legacy_products.py)

     ---
     Neue DB-Tabellen (zusätzlich zu MODERN_SCHEMA_PROPOSAL.sql)

     Wiederverwendet: products, product_groups, suppliers, product_suppliers, users,
     roles, user_roles, permissions, role_permissions, audit_log

     Neu für Lagerwesen:
     - warehouses – Lager/Standorte (code, name, address, is_active)
     - warehouse_zones – Zonen (warehouse_id, code, name, zone_type, is_active)
     - bin_locations – Lagerplätze (zone_id, code, bin_type, max_weight, max_volume,
     qr_code_data)
     - product_warehouse_settings – Lager-Erweiterung pro Artikel (ean, gtin, gewichte,
     abmessungen, min/max/melde/sicherheitsbestand, lead_time, qr_code_data)
     - inventory – Bestand (product_id, bin_location_id, quantity, reserved_quantity,
     unit) UNIQUE(product_id, bin_location_id)
     - stock_movements – Bewegungsjournal (movement_type, reference_type,
     reference_number, product_id, from_bin_id, to_bin_id, quantity, performed_by,
     performed_at)
     - goods_receipts + goods_receipt_items – Wareneingang Header + Positionen
     - goods_issues + goods_issue_items – Warenausgang Header + Positionen
     - stock_transfers + stock_transfer_items – Umlagerung Header + Positionen

     ---
     25 Aufgaben in 12 Sub-Phasen

     Phase 1.0: Projekt-Setup & Infrastruktur

     Task 1.0.1 – Repository + Docker-Infrastruktur
     - Git init, .gitignore, .env.example
     - docker-compose.yml: PostgreSQL 16, Backend, Frontend, Nginx
     - docker-compose.dev.yml: Hot-Reload, Debug-Ports
     - Validierung: docker compose up --build startet alle 4 Services

     Task 1.0.2 – Backend-Projekt (FastAPI + SQLAlchemy)
     - backend/Dockerfile (Multi-Stage: development + production)
     - backend/pyproject.toml mit allen Dependencies (fastapi, uvicorn,
     sqlalchemy[asyncio], asyncpg, alembic, pydantic, python-jose, passlib, qrcode[pil])
     - app/main.py, app/config.py, app/database.py – Grundgerüst mit CORS und
     Health-Endpoint

     Task 1.0.3 – Frontend-Projekt (React + Vite + Tailwind + shadcn/ui)
     - frontend/Dockerfile, package.json mit react 19, vite 6, tailwind v4, shadcn/ui,
     tanstack-query, zustand, html5-qrcode, react-router v7, recharts, lucide-react,
     axios, sonner
     - shadcn/ui init + Basis-Komponenten (button, input, card, dialog, table, tabs,
     toast, badge, select, sheet, form)
     - vite.config.ts, tsconfig.json

     Task 1.0.4 – Nginx + Docker-Validierung
     - nginx/nginx.conf: /api/* → Backend, / → Frontend
     - Test: Alle Services starten, Health-Endpoint erreichbar

     ---
     Phase 1.1: Backend Core

     Task 1.1.1 – SQLAlchemy-Modelle + Alembic-Migration
     - Alle Modelle: User, Role, Product, ProductGroup, ProductWarehouseSettings,
     Warehouse, WarehouseZone, BinLocation, Inventory, StockMovement,
     GoodsReceipt/Items, GoodsIssue/Items, StockTransfer/Items, AuditLog
     - alembic init, env.py konfigurieren, initiale Migration generieren + ausführen

     Task 1.1.2 – Authentifizierung + Benutzerverwaltung
     - JWT: Access-Token (15min) + Refresh-Token (7d)
     - Endpoints: POST /api/auth/login, /api/auth/refresh, /api/auth/logout, GET
     /api/auth/me
     - User-CRUD: GET/POST/PUT/DELETE /api/users, PATCH /api/users/{id}/password
     - Dependencies: get_current_user, require_admin
     - Seed: Default-Admin (admin/DirectStock2026!), Rollen (admin, lagerleiter,
     lagermitarbeiter)

     Task 1.1.3 – Audit-Middleware + Error-Handling
     - Middleware: Jeder POST/PUT/PATCH/DELETE → audit_log (Tabelle, ID, Aktion,
     alte/neue Werte JSONB, User, Timestamp)
     - Einheitliche Error-Responses mit Error-Codes
     - Request-ID-Header

     ---
     Phase 1.2: Frontend Core

     Task 1.2.1 – App-Shell, Routing, Layout
     - AppLayout.tsx: Sidebar (280px, einklappbar auf 72px) + TopBar + Content
     - Sidebar-Navigation (deutsch): Dashboard, Artikelstamm, Lagerstruktur,
     Bestandsübersicht, Wareneingang, Warenausgang, Umlagerung, Scanner,
     Benutzerverwaltung (nur Admin)
     - React Router v7 mit allen Routen
     - Tablet-Design: 48px Touch-Targets, 16px Basisschrift, 12px Padding

     Task 1.2.2 – Auth-Integration Frontend
     - authStore.ts (Zustand): user, tokens, login/logout/refresh
     - api.ts (Axios): Interceptor für auto Token-Refresh bei 401
     - ProtectedRoute.tsx, RequireRole.tsx
     - LoginPage.tsx: Zentriertes Card, Username + Passwort

     ---
     Phase 1.3: Artikelstamm

     Task 1.3.1 – Backend Artikelstamm-API
     - GET /api/products (Paginierung, Suche, Filter nach Gruppe/Status)
     - GET/POST/PUT/DELETE /api/products/{id}
     - GET /api/products/by-qr/{qr_data}, GET /api/products/by-ean/{ean}
     - GET/POST/PUT /api/product-groups

     Task 1.3.2 – Frontend Artikelstamm-UI
     - ProductsPage: DataTable mit Suche/Filter, 56px Zeilenhöhe
     - ProductFormPage: Tabs (Stammdaten, Lagerdaten, Lieferanten)
     - ProductDetailPage: Alle Daten + aktueller Bestand + letzte Bewegungen

     ---
     Phase 1.4: Lagerstruktur

     Task 1.4.1 – Backend Lagerstruktur-API
     - CRUD: /api/warehouses, /api/warehouses/{id}/zones, /api/zones/{id}/bins
     - Batch-Erstellung: POST /api/zones/{id}/bins/batch (generiert z.B. A-01-01-01 bis
     A-05-10-04)
     - QR-Lookup: GET /api/bins/by-qr/{qr_data}
     - QR-Druck: GET /api/bins/{id}/qr-code (PNG), POST /api/bins/qr-codes/pdf
     - QR-Format: DS:BIN:{code} und DS:ART:{product_number}

     Task 1.4.2 – Frontend Lagerstruktur-UI
     - Karten-Layout für Lager, Baum-Navigation Zonen>Lagerplätze
     - BinLocationGrid: Visuelles Raster (farbcodiert nach Belegung)
     - QRPrintDialog: Auswahl + PDF-Generierung (2x5 Etiketten pro A4)
     - BinBatchCreateDialog: Massenanlage

     ---
     Phase 1.5: QR-Code & Scanner

     Task 1.5.1 – Universelle Scanner-Komponente
     - CameraScanner.tsx: html5-qrcode Wrapper (fps:10, qrbox:300x300, Rückkamera)
     - ExternalScannerListener.tsx: Tastatur-Emulation erkennen (<50ms zwischen Zeichen,
      Enter = Scan)
     - ScanFeedback.tsx: Visuell (grün/rot Flash), Akustisch (Web Audio API), Haptisch
     (navigator.vibrate)
     - scannerUtils.ts: QR-Parsing (DS:BIN:... → bin_location, DS:ART:... → product,
     13-stellig → EAN)
     - ScannerPage.tsx: Standalone-Scanner für Lookups
     - scannerStore.ts (Zustand): Scan-Modus, letzte Scans, Offline-Queue

     ---
     Phase 1.6: Wareneingang

     Task 1.6.1 – Backend Wareneingang-API
     - CRUD: /api/goods-receipts, /api/goods-receipts/{id}/items
     - Abschluss: POST /api/goods-receipts/{id}/complete → stock_movements +
     inventory-Update (Transaktion)
     - Storno: POST /api/goods-receipts/{id}/cancel

     Task 1.6.2 – Frontend Wareneingang-Workflow
     - Step-by-Step: Header → [Artikel scannen → Menge → Lagerplatz scannen →
     Bestätigen]* → Übersicht → Abschließen
     - Progress-Bar, große Buttons (100% Breite, 64px Höhe), erfasste Positionen immer
     sichtbar

     ---
     Phase 1.7: Bestandsübersicht

     Task 1.7.1 – Backend Bestands-API
     - GET /api/inventory (aggregiert), /api/inventory/by-product/{id},
     /api/inventory/by-bin/{id}, /api/inventory/by-warehouse/{id}
     - GET /api/inventory/low-stock, /api/inventory/movements, /api/inventory/summary

     Task 1.7.2 – Frontend Bestandsübersicht-UI
     - InventoryTable: Artikelnr, Bezeichnung, Gesamtbestand, Verfügbar, Ampel-Badge
     - ProductStockDetail (Sheet): Bestand pro Lagerplatz + letzte 10 Bewegungen
     - Auto-Refresh: 30 Sekunden

     ---
     Phase 1.8: Warenausgang

     Task 1.8.1 – Backend Warenausgang-API
     - Analog zu Wareneingang, aber mit Bestandsprüfung (genug Bestand am Lagerplatz?)
     - Bei complete: Bestand reduzieren + stock_movement (goods_issue)

     Task 1.8.2 – Frontend Warenausgang-Workflow
     - Umgekehrter Flow: Lagerplatz scannen → verfügbare Artikel anzeigen → Artikel
     scannen → Menge → Bestätigen
     - Warnungen bei niedrigem Restbestand / unter Meldebestand

     ---
     Phase 1.9: Umlagerung

     Task 1.9.1 – Backend Umlagerungs-API
     - Quell-Lagerplatz → Artikel → Menge → Ziel-Lagerplatz
     - Atomare Transaktion: Quelle - Menge + Ziel + Menge

     Task 1.9.2 – Frontend Umlagerungs-UI
     - 5-Schritt-Workflow: Quell-Scan → Artikel-Scan → Menge → Ziel-Scan → Bestätigen

     ---
     Phase 1.10: Dashboard

     Task 1.10.1 – Backend Dashboard-API
     - GET /api/dashboard/summary (Gesamt-KPIs), /api/dashboard/recent-movements,
     /api/dashboard/low-stock, /api/dashboard/activity-today

     Task 1.10.2 – Frontend Dashboard-UI
     - 4 KPI-Cards oben (Gesamtartikel, Auslastung, offene WE, Artikel unter
     Meldebestand)
     - Quick-Actions (Neuer WE, WA, Umlagerung, Scanner)
     - 2-Spalten unten: Letzte Bewegungen (Timeline) + Niedrige Bestände (Ampel-Liste)
     - Auto-Refresh: 60 Sekunden

     ---
     Phase 1.11: PWA & Testing

     Task 1.11.1 – PWA-Konfiguration
     - vite-plugin-pwa: Manifest (name: "DirectStock Lagerverwaltung", display:
     standalone), Icons
     - Workbox-Strategien: StaleWhileRevalidate für Stammdaten, NetworkFirst für
     Bestände
     - Offline-Indikator, Install-Prompt, Update-Banner

     Task 1.11.2 – Seed-Daten + Legacy-Import
     - seed_data.py: 1 Lager, 3 Zonen, 150 Lagerplätze, 5 Produktgruppen, 50 Artikel, 3
     User, Initialbestände
     - import_legacy_products.py: CSV-Import aus LLMRAG (73.596 Produkte gemäß
     MIGRATION_MAPPING.md)

     Task 1.11.3 – Backend-Tests (pytest)
     - Tests für: Auth, Products, Warehouse, Inventory, Goods Receipt/Issue, Stock
     Transfer
     - Mindest: Login, CRUD, kompletter WE/WA-Workflow inkl. Bestandsprüfung

     Task 1.11.4 – Frontend-Tests (Vitest + Playwright)
     - Unit: scannerUtils, authStore
     - E2E: Login → Dashboard, Artikel suchen, Wareneingang-Workflow komplett,
     Bestandsübersicht

     Task 1.11.5 – Production-Build + Deployment-Test
     - Production-Dockerfiles (Frontend: Nginx mit statischen Assets, Backend: uvicorn 4
      Workers)
     - Checkliste: Alle Services starten, Login funktioniert, PWA installierbar
     (Lighthouse >90), Scanner auf Tablet, WE-Workflow E2E

     ---
     Zusammenfassung

     ┌───────────────────┬───────────────┬──────────────┐
     │     Sub-Phase     │     Tasks     │   Sessions   │
     ├───────────────────┼───────────────┼──────────────┤
     │ 1.0 Setup         │ 1.0.1–1.0.4   │ 4            │
     ├───────────────────┼───────────────┼──────────────┤
     │ 1.1 Backend Core  │ 1.1.1–1.1.3   │ 5            │
     ├───────────────────┼───────────────┼──────────────┤
     │ 1.2 Frontend Core │ 1.2.1–1.2.2   │ 3            │
     ├───────────────────┼───────────────┼──────────────┤
     │ 1.3 Artikelstamm  │ 1.3.1–1.3.2   │ 4            │
     ├───────────────────┼───────────────┼──────────────┤
     │ 1.4 Lagerstruktur │ 1.4.1–1.4.2   │ 4            │
     ├───────────────────┼───────────────┼──────────────┤
     │ 1.5 Scanner       │ 1.5.1         │ 2            │
     ├───────────────────┼───────────────┼──────────────┤
     │ 1.6 Wareneingang  │ 1.6.1–1.6.2   │ 5            │
     ├───────────────────┼───────────────┼──────────────┤
     │ 1.7 Bestand       │ 1.7.1–1.7.2   │ 3            │
     ├───────────────────┼───────────────┼──────────────┤
     │ 1.8 Warenausgang  │ 1.8.1–1.8.2   │ 3            │
     ├───────────────────┼───────────────┼──────────────┤
     │ 1.9 Umlagerung    │ 1.9.1–1.9.2   │ 2            │
     ├───────────────────┼───────────────┼──────────────┤
     │ 1.10 Dashboard    │ 1.10.1–1.10.2 │ 3            │
     ├───────────────────┼───────────────┼──────────────┤
     │ 1.11 PWA & Tests  │ 1.11.1–1.11.5 │ 7            │
     ├───────────────────┼───────────────┼──────────────┤
     │ Gesamt            │ 25 Tasks      │ ~45 Sessions │
     └───────────────────┴───────────────┴──────────────┘

     Verifikation

     1. docker compose up --build → alle Services gesund
     2. pytest backend/tests/ → alle Tests grün
     3. npm run test im frontend → Unit-Tests grün
     4. npx playwright test → E2E-Tests grün
     5. Lighthouse Audit auf / → PWA Score > 90
     6. Manueller Test: Tablet, Kamera-Scanner, Wareneingang komplett durchspielen

     Kritische Referenz-Dateien

     - LLMRAG/ab_db_data/MODERN_SCHEMA_PROPOSAL.sql – Basis-Schema zum Erweitern
     - LLMRAG/ab_db_data/MIGRATION_MAPPING.md – Feld-Mapping für Legacy-Import
     - LLMRAG/ab_db_data/data/csv/products.csv – 73.596 Legacy-Produkte
     - LLMRAG/docker-compose.yml – Docker-Patterns als Referenz
     - DirectStock/directstock.md – Masterplan (alle Features & Workflows)
