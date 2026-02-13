## DirectStock Phase 2 - Umsetzungsstatus

Stand: **13. Februar 2026**
Gesamtstatus: **DONE**

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
| 2.1.2 Alembic-Migrationen für Chargen/Serien/Inventur/Alerts/Idempotency | DONE | `0003_client_operation_log`, `0004_batch_and_serial_tracking`, `0005_inventory_counts` und `0006_alert_rules_and_events` vollständig umgesetzt |
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
| 2.8.1 Alert-Regeln + Event-Engine Backend | DONE | Alert-Modelle/Migration, `/api/alert-rules` + `/api/alerts`, Dedupe/Ack-Logik und Trigger bei WE/WA/Umlagerung/Inventur inkl. `scripts/run_alert_checks.py` umgesetzt |
| 2.8.2 Alert-UI + Acknowledge + Dashboard-Einbindung | DONE | Neue `AlertsPage` mit Filter/Acknowledge, Navigation/Route, Dashboard-Widget für kritische Alerts und E2E-Flow umgesetzt |
| 2.9.1 Offline-Queue-Engine Frontend (Read+Queue+Sync) | DONE | Offline-Queue in IndexedDB fuer WE/WA/Umlagerung/Inventur-Mutationen, globales Sync-Panel (Queue/Retry/Discard), Auto-Sync bei Reconnect und E2E-Flow umgesetzt |
| 2.9.2 Backend-Idempotency + Konfliktcodes | DONE | Zentraler Idempotency-Middleware für Offline-relevante Mutationen inkl. Replay und standardisiertem `409`-Conflict mit `details`, getestet über `test_offline_idempotency.py` |
| 2.10.1 RBAC-Rollenerweiterung und Rechte-Matrix | DONE | Backend-Guards für Phase-2-Module auf Rollenmatrix verdichtet (WE/Einkauf, WA/Versand, Inventur, Lieferanten/Kunden, Einkauf, Reports/Alerts), Frontend-Routeguards+Menü rollenspezifisch ergänzt, RBAC-Testmatrix erweitert |
| 2.11.1 Gesamtverifikation, Doku, Abnahmereport | DONE | Vollständige Verifikation (Backend/Frontend/E2E/Lighthouse) durchgeführt, Doku aktualisiert und Abnahmereport unter `docs/validation/phase2-acceptance.md` ergänzt |

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
- `backend`: `54 passed` (`backend/.venv/bin/python -m pytest -q`)
- `frontend unit`: `13 passed` (`npm run test`)
- `frontend build`: erfolgreich (`npm run build`)
- `frontend e2e`: erfolgreich (`npm run test:e2e` -> `8 passed`)
- `lighthouse/pwa`: `1.00` (`./scripts/lighthouse_pwa.sh`, Schwellwert `>= 0.90`)  
  Artefakte: `artifacts/lighthouse/lighthouse.report.json`, `artifacts/lighthouse/lighthouse.report.html`
