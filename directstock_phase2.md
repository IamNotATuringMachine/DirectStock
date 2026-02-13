## DirectStock Phase 2 - Umsetzungsstatus

Stand: **13. Februar 2026**
Gesamtstatus: **IN PROGRESS**

### Legende
- `DONE`: vollständig umgesetzt und verifiziert
- `IN PROGRESS`: in Umsetzung
- `OPEN`: noch nicht begonnen

### Scope
- In Scope: Features 11-18 aus `directstock.md`
- Out of Scope: Legacy-Transaktionsmigration (Masterplan 14 Phase 2), Versanddienstleister-Integration, vollautomatische ABC-/Bestellvorschlags-Automation, vollständiges Dokumentenmanagement

### Task-Statusmatrix 2.0-2.11

| Task | Status | Kurzbegründung |
|---|---|---|
| 2.0.1 Phase-2-Baseline und Kontraktrahmen | DONE | Dieses Dokument als Source-of-Truth für Reihenfolge, Scope und Verifikation angelegt |
| 2.1.1 Alembic-Migrationen für Lieferanten/Kunden/Einkauf | DONE | Migration `0002_customers_and_purchasing` erstellt und verifiziert |
| 2.1.2 Alembic-Migrationen für Chargen/Serien/Inventur/Alerts/Idempotency | IN PROGRESS | Idempotency via `0003_client_operation_log`, Chargen/Serien via `0004_batch_and_serial_tracking`, Inventur-Basis via `0005_inventory_counts` ergänzt |
| 2.2.1 Lieferanten-Backend (CRUD + Zuordnung) | DONE | Supplier- und ProductSupplier-API inkl. Tests implementiert |
| 2.2.2 Kunden-Backend (CRUD + Nutzung im WA) | DONE | Customer-API und Goods-Issue-`customer_id`-Integration inkl. Tests implementiert |
| 2.3.1 Produkt-Lagerdaten + Lieferanten-API | DONE | ProductWarehouseSetting-Endpunkte inkl. Low-Stock-Verifikation implementiert |
| 2.3.2 Produktformular Tabs Lagerdaten/Lieferanten produktiv | DONE | `ProductFormPage` mit API-gebundener Lagerdaten- und Lieferantenpflege erweitert |
| 2.4.1 Einkaufsmodul Backend (Bestellungen) | DONE | Purchase-Order-Workflow (CRUD, Items, Status-Transitions) inkl. Tests implementiert |
| 2.4.2 Einkaufsmodul Frontend (Bestellworkflow) | DONE | `PurchasingPage`, Navigation, Routing und E2E-Spec ergänzt; E2E-Lauf gegen laufenden Stack grün |
| 2.5.1 Chargenlogik im Wareneingang und Bestand | DONE | WE-Item um Batch/MHD erweitert, Batchbestände inkl. FEFO-Entnahme und Inventory-Batch-Views umgesetzt |
| 2.5.2 Seriennummernlogik in WA/Umlagerung | DONE | Seriennummern-Erfassung in WE sowie Validierung/Statuswechsel in WA und Umlagerung inkl. Double-Issue-Schutz umgesetzt |
| 2.6.1 Inventur-Backend (Stichtag + permanent) | DONE | Inventur-Sessions/Items, Nachzähl-Logik, Differenzbuchung als `inventory_adjustment` und API-Tests umgesetzt |
| 2.6.2 Inventur-Frontend inkl. Scan-Flow | DONE | `InventoryCountPage` mit Session-/Zähllisten-/Schnellerfassungs-Flow, Navigation/Route und E2E-Flow umgesetzt |
| 2.7.1 Reports/KPI-Backend + CSV-Export | DONE | Neue `/api/reports/*`-Endpunkte (`stock`, `movements`, `inbound-outbound`, `inventory-accuracy`, `abc`, `kpis`) inkl. CSV-Export und Tests umgesetzt |
| 2.7.2 Reports/KPI-Frontend + Dashboard-Erweiterung | DONE | Neue `ReportsPage` mit Filtern/CSV-Export, Dashboard um KPI-Karten (Turnover, Dock-to-Stock, Inventory Accuracy, Alert Count) erweitert, E2E-Smoketest ergänzt |
| 2.8.1 Alert-Regeln + Event-Engine Backend | OPEN | Noch nicht begonnen |
| 2.8.2 Alert-UI + Acknowledge + Dashboard-Einbindung | OPEN | Noch nicht begonnen |
| 2.9.1 Offline-Queue-Engine Frontend (Read+Queue+Sync) | OPEN | Noch nicht begonnen |
| 2.9.2 Backend-Idempotency + Konfliktcodes | OPEN | Noch nicht begonnen |
| 2.10.1 RBAC-Rollenerweiterung und Rechte-Matrix | OPEN | Noch nicht begonnen |
| 2.11.1 Gesamtverifikation, Doku, Abnahmereport | OPEN | Noch nicht begonnen |

### Abnahmekriterien pro Batch
1. Additive API-Erweiterungen ohne Breaking-Change.
2. DB-Änderungen ausschließlich via Alembic.
3. RBAC serverseitig abgesichert.
4. Relevante Tests grün.
5. Doku und Verifikationsstand aktualisiert.

### Verifikations-Checkliste (Phase 2)
- `cd backend && python -m pytest -q`
- `cd frontend && npm run test`
- `cd frontend && npm run build`
- `cd frontend && npm run test:e2e`
- `./scripts/lighthouse_pwa.sh`

### Verifikationsstand (aktueller Batch)
- `backend`: `41 passed` (`backend/.venv/bin/python -m pytest -q`)
- `frontend unit`: `9 passed` (`npm run test`)
- `frontend build`: erfolgreich (`npm run build`)
- `frontend e2e`: erfolgreich (`npm run test:e2e` -> `6 passed`)
- `lighthouse/pwa`: nicht ausgeführt
