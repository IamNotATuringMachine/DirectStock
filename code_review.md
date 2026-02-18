  # DirectStock Code Review & QA Report

Datum: 2026-02-14 (UTC)
Reviewer: Codex (Tech Lead SWE)
Scope: Vollprüfung gegen `directstock.md` inkl. Backend, Frontend, E2E, Jobs, Migration, PWA.

## 1. Vorgehen

1. Soll-Abgleich: Vollständige Analyse aller Feature-Bereiche aus `directstock.md`.
2. Ist-Abgleich: Router, Modelle, Schemas, Frontend-Routen/Seiten/Services, Middleware, Migrationen.
3. QA-Läufe: Unit, Integration, E2E, Build, Migration Dry-Run, Forecast Batch, Alert Batch, Lighthouse.
4. Priorisierung: Findings nach Severity (`P0` kritisch bis `P3` niedrig).

## 2. Ausgeführte Verifikation

### 2.1 Erfolgreiche Läufe

1. `cd backend && source .venv/bin/activate && pytest -q`
   Ergebnis: `79 passed in 38.23s`
2. `cd frontend && npm run test -- --run`
   Ergebnis: `5 files, 19 tests passed`
3. `cd frontend && npm run build`
   Ergebnis: erfolgreicher Typecheck + Vite Build
4. `docker compose up -d --build` + Health-Check
   Ergebnis: `/health` und `/api/health` jeweils `{"status":"ok"}`
5. `cd frontend && npm run test:e2e`
   Ergebnis: `19 passed, 2 skipped` (Desktop-Projekt)
6. `docker compose exec -T backend python /app/scripts/migrate_legacy_full.py --mode dry-run --domain all --source /app/backend/tests/fixtures/legacy_full`
   Ergebnis: alle 4 Domains erfolgreich, `errors=0`
7. `docker compose exec -T backend python /app/scripts/run_demand_forecast.py`
   Ergebnis: `Demand forecast completed ... items=17`
8. `docker compose exec -T backend python /app/scripts/run_alert_checks.py`
   Ergebnis: `created=0`
9. `./scripts/lighthouse_pwa.sh`
   Ergebnis: `PWA score: 1 (threshold: 0.9)`

### 2.2 QA-Coverage-Hinweis

- E2E in `frontend/package.json:11` läuft nur `--project=web-desktop`, obwohl in `frontend/playwright.config.ts:18-44` zusätzlich iPhone/iPad-Projekte definiert sind.

## 3. Executive Summary

Fazit: **Nicht alle Funktionen aus `directstock.md` sind vollständig implementiert.**
Der Phase-4-Stand ist technisch stabil und testbar, aber der Masterplan enthält deutlich breiteren Endausbau als der aktuelle Implementierungsumfang.

Priorisierte Gesamtlage:

- `P0`: 1 Finding
- `P1`: 3 Findings
- `P2`: 7 Findings
- `P3`: 4 Findings

## 4. Priorisierte Findings (Bugs/Risiken)

## P0

### CR-001: Path Traversal in Dokumenten-Upload
- Severity: `P0`
- Kategorie: Security / Data Integrity
- Befund: `entity_type` und `document_type` werden ungeprüft in den Dateisystempfad übernommen.
- Beleg:
  - `backend/app/routers/documents.py:81-83`
  - `backend/app/routers/documents.py:117-121`
- Risiko:
  - Schreibzugriff außerhalb des vorgesehenen Storage-Roots möglich (`../`-Traversal).
  - Potenzielles Überschreiben beliebiger Dateien im Container-Kontext mit Schreibrechten.
- Empfehlung:
  1. `entity_type` und `document_type` strikt whitelisten (Enum/Regex ohne `/`, `..`, `\`).
  2. Finalen Pfad per `resolve()` validieren und sicherstellen, dass er unter dem erlaubten Root liegt.
  3. Zusätzlich serverseitige Entity-Typ-Validierung (nur bekannte Domains).

## P1

### CR-002: Interne Storage-Pfade werden über API offengelegt
- Severity: `P1`
- Kategorie: Security / Information Disclosure
- Befund: `storage_path` wird in API-Responses zurückgegeben.
- Beleg:
  - `backend/app/routers/documents.py:45`
  - `backend/app/schemas/phase3.py:243-252`
- Risiko:
  - Exponierte interne Dateipfade erleichtern spätere Angriffe und Infrastruktur-Reconnaissance.
- Empfehlung:
  - `storage_path` aus externen Responses entfernen; stattdessen nur `document_id` + Download-Endpoint exponieren.

### CR-003: 500-Fehler geben interne Exception-Texte an Clients weiter
- Severity: `P1`
- Kategorie: Security / Information Disclosure
- Befund: Globaler Exception-Handler schreibt `details=str(exc)` in API-Response.
- Beleg:
  - `backend/app/middleware/error_handler.py:60-68`
- Risiko:
  - Leck von internem Stack-/DB-/Pfadwissen.
- Empfehlung:
  1. In Produktion generische Details (`null` oder standardisiert) ausgeben.
  2. Technische Details nur serverseitig loggen (mit `request_id`).

### CR-004: Unsichere Security-Fallbacks in Runtime-Defaults
- Severity: `P1`
- Kategorie: Security Baseline
- Befund: Fallback-Defaults enthalten schwache/öffentliche Secrets und statische Admin-Credentials.
- Beleg:
  - `backend/app/config.py:19`
  - `backend/app/config.py:25-27`
  - `backend/app/config.py:35-36`
- Risiko:
  - Fehlkonfigurationen führen direkt zu angreifbarer Instanz.
- Empfehlung:
  1. Startup-Fail, wenn produktive Umgebung und Default-Secret erkannt.
  2. Keine produktionsfähigen Passwortdefaults im Code.

## P2

### CR-005: CORS-Konfiguration ist funktional und sicherheitstechnisch inkonsistent
- Severity: `P2`
- Kategorie: Security / Runtime Behavior
- Befund: `allow_origins=["*"]` mit `allow_credentials=True`.
- Beleg:
  - `backend/app/config.py:12`
  - `backend/app/main.py:57-63`
- Risiko:
  - Browser-CORS-Verhalten für Credential-Flows uneinheitlich/fehleranfällig.
  - Zu breite Origin-Freigabe in Fehlkonfigurationen.
- Empfehlung:
  - In produktiven Umgebungen nur explizite Origins zulassen; `*` nur für lokale Entwicklung.

### CR-006: Dokumente können auf nicht existente Fachobjekte zeigen (Orphans)
- Severity: `P2`
- Kategorie: Data Integrity
- Befund: Bei Upload wird keine fachliche Existenzprüfung für `entity_type/entity_id` durchgeführt.
- Beleg:
  - `backend/app/routers/documents.py:79-137`
- Risiko:
  - Orphan-Dokumente und inkonsistente Verknüpfungen.
- Empfehlung:
  - Je `entity_type` Existenz-Check einführen (z. B. `shipment`, `return_order`, ...).

### CR-007: Fehlende Pagination in mehreren Listenendpunkten
- Severity: `P2`
- Kategorie: Performance / Skalierung
- Befund: Mehrere Endpunkte laden komplette Tabellen ohne Paging.
- Beleg:
  - `backend/app/routers/documents.py:67-76`
  - `backend/app/routers/shipping.py:103-116`
  - `backend/app/routers/inter_warehouse_transfers.py:147-153`
- Risiko:
  - Mit wachsendem Datenbestand steigende Antwortzeiten und Speicherlast.
- Empfehlung:
  - Standardisiertes Paging (`page`, `page_size`, `total`) für alle Listen.

### CR-008: Offline-Queue deckt Phase-4-Mutationen nicht konsistent ab
- Severity: `P2`
- Kategorie: Offline / UX / Idempotency-Alignment
- Befund:
  - Backend-Idempotency umfasst u. a. `/api/inter-warehouse-transfers`, `/api/shipments`.
  - Frontend-Offline-Scope enthält diese Prefixe nicht.
- Beleg:
  - `backend/app/middleware/idempotency.py:15-27`
  - `frontend/src/services/offlineQueue.ts:37-45`
  - `frontend/src/services/interWarehouseTransfersApi.ts:13-59`
- Risiko:
  - Uneinheitliches Offline-Verhalten, besonders in mobilen Lagerumgebungen.
- Empfehlung:
  - Entscheiden: entweder vollständige Offline-Queue-Erweiterung für Phase-4-Flows oder expliziter Produktentscheid „online-only“ inkl. UX-Hinweis.

### CR-009: Reports-Export unterstützt nur CSV, nicht PDF/Excel laut Masterplan
- Severity: `P2`
- Kategorie: Functional Gap
- Befund: `format` ist nur `json|csv`.
- Beleg:
  - `backend/app/routers/reports.py:153`
  - `backend/app/routers/reports.py:733`
  - `backend/app/routers/reports.py:793`
- Risiko:
  - Anforderungsabweichung zu `directstock.md` (Export CSV/PDF/Excel).
- Empfehlung:
  - Exportstrategie erweitern (mindestens XLSX; PDF für formalisierte Reports).

### CR-010: Benutzerverwaltung im Frontend ist Platzhalter
- Severity: `P2`
- Kategorie: Functional Gap / UX
- Befund: Route existiert, aber nur statischer Header.
- Beleg:
  - `frontend/src/pages.tsx:23-25`
  - `frontend/src/App.tsx:183-189`
- Risiko:
  - Admin-Usecase „Benutzerverwaltung“ nicht operativ nutzbar im UI.
- Empfehlung:
  - Vollwertige Users-Page mit CRUD, Rollen, Aktivierung/Sperrung, Passwortaktion.

### CR-011: Auth-Funktionsumfang unter Masterplan (2FA/Reset/Session-Policies)
- Severity: `P2`
- Kategorie: Functional Gap / Security
- Befund:
  - Kein 2FA-Flow, kein Self-Service Passwort-Reset-Flow.
  - Session-Timeout/Idle-Logout im Frontend nicht implementiert.
- Beleg:
  - Auth API beschränkt auf Login/Refresh/Logout/Me: `backend/app/routers/auth.py:20-56`
  - Passwortänderung nur Admin-Route: `backend/app/routers/users.py:96-113`
  - Persistente Tokenhaltung ohne Idle-Timeout-Mechanik: `frontend/src/stores/authStore.ts:19-69`
- Risiko:
  - Abweichung von Security-/Usability-Zielen im Masterplan.
- Empfehlung:
  - 2FA-Option, Passwort-Reset-Prozess, Idle-Timeout-Mechanik ergänzen.

## P3

### CR-012: Mobile E2E-Projekte sind definiert, aber Standardlauf testet nur Desktop
- Severity: `P3`
- Kategorie: QA Coverage
- Befund:
  - Playwright-Projekte für iOS existieren, Standardskript nutzt nur `web-desktop`.
- Beleg:
  - `frontend/playwright.config.ts:18-44`
  - `frontend/package.json:11`
- Risiko:
  - Mobile Regressionen werden im Standard-Flow nicht automatisch abgefangen.
- Empfehlung:
  - CI/Standardskript um mindestens ein mobiles Projekt ergänzen.

### CR-013: Build/Test-Läufe erzeugen schnell „dirty worktree“
- Severity: `P3`
- Kategorie: Repo-Hygiene
- Befund:
  - Getrackte `egg-info`-Artefakte ändern sich durch `pip install -e`.
  - Generierte Label-Dokumente unter `backend/.documents/...` werden nicht ignoriert.
- Beleg:
  - Getrackte Metadaten: `backend/directstock_backend.egg-info/PKG-INFO`, `backend/directstock_backend.egg-info/SOURCES.txt`, `backend/directstock_backend.egg-info/requires.txt`
  - `.gitignore` enthält keine Regeln für `backend/.documents` oder `backend/directstock_backend.egg-info`: `.gitignore:1-33`
- Risiko:
  - Nebengeräusche in PRs, höheres Risiko versehentlicher Artefakt-Commits.
- Empfehlung:
  - `egg-info` aus VCS entfernen, Artefaktpfade in `.gitignore` ergänzen.

### CR-014: NPM-Abhängigkeitsrisiken im Frontend-Build
- Severity: `P3`
- Kategorie: Dependency Hygiene
- Befund: `npm ci` meldet `5 moderate severity vulnerabilities` (Lighthouse-Build-Log).
- Risiko:
  - Langfristige Supply-Chain-/Compliance-Risiken.
- Empfehlung:
  - `npm audit` triagieren, sichere Upgrades planen, ggf. Overrides setzen.

### CR-015: Auth-Rate-Limit nur für External API, nicht für Login/Refresh
- Severity: `P3`
- Kategorie: Security Hardening
- Befund: Nginx-Limits nur für `/api/external/*`, nicht für `/api/auth/*`.
- Beleg:
  - `nginx/nginx.conf:14-37`
  - `nginx/nginx.prod.conf:9-32`
- Risiko:
  - Erhöhte Angriffsfläche für Credential-Stuffing/Brute-Force.
- Empfehlung:
  - Separate Rate-Limits für Auth-Endpunkte einführen.

## 5. Abdeckungsmatrix gegen directstock.md

Legende: `Erfüllt` / `Teilweise` / `Nicht erfüllt`

1. Stammdaten (Artikel/Lieferanten/Kunden/Lagerstruktur): **Teilweise**
- Positiv: Kernobjekte vorhanden (`products`, `suppliers`, `customers`, `warehouses`, `zones`, `bins`).
- Gaps:
  - Artikel: nur ein `product_group_id`, keine Mehrfachkategorisierung/Bilder/Custom-Fields/Einheitenumrechnung im Kernmodell (`backend/app/models/catalog.py:25-35`).
  - Lieferanten: keine separaten Adressen, Rating, Zertifikate (`backend/app/models/catalog.py:41-47`, `backend/app/schemas/supplier.py:7-13`).
  - Kunden: keine Kundengruppen/Preisgruppen/mehrere Lieferadressen (`backend/app/schemas/customer.py:7-18`).
  - Lagerstruktur: keine expliziten Aisle/Shelf/Level-Felder als eigene Strukturen, nur codierte `code`-Strings pro Bin (`backend/app/models/warehouse.py:43-58`).

2. Wareneingang: **Teilweise**
- Positiv: Purchase Orders, Goods Receipt, Items, Completion, Scan-Unterstützung.
- Gaps: ASN/Avisierung, Schadensfoto-/Qualitätsworkflow, tieferer Soll/Ist-Lieferscheinabgleich als eigener Prozess.

3. Bestandsführung: **Teilweise**
- Positiv: Bestände, Bewegungen, Batch/Serial, Inventur-Session/Items.
- Gaps: formale Chargenrückruf-Funktion, umfassende Zeitreihen-Historisierung pro KPI aus Masterplan.

4. Warenausgang: **Teilweise**
- Positiv: Goods Issue, Picking, Shipping, Transfer.
- Gaps: ATP-Lieferterminprüfung, Packstation-/Verpackungsvorschläge/Gewichtskontrolle als eigene Domäne.

5. Retouren: **Teilweise**
- Positiv: Return Orders + Item Decisions + Status.
- Gaps: expliziter RMA-Prozess inkl. Abgleich mit Originalauftrag als eigener Fachworkflow.

6. QR/Scanning-System: **Teilweise**
- Positiv: Kamera-Scanner, External Scanner Listener, Scan-Feedback inkl. Beep/Vibration (`frontend/src/components/scanner/ScanFeedback.tsx:43-50`).
- Gaps: durchgängige QR-Label-Flows für alle Dokumenttypen/Behälterarten im Masterplan.

7. Alerts/Benachrichtigungen/Automatisierung: **Teilweise**
- Positiv: Alert-Rules, Alerts, Ack, ABC + Empfehlungen.
- Gaps: keine E-Mail-/Push-Kanäle und Eskalationsstufen als nachweisbarer Codepfad.

8. Reporting/Analyse/Dashboard: **Teilweise**
- Positiv: viele JSON/CSV-Reports, KPIs, Trends/Forecast.
- Gaps: Export PDF/Excel, vollständige KPI-Liste aus Masterplan (u. a. Servicelevel, Dock-to-Stock-Time als explizite Metriken).

9. Benutzerverwaltung & RBAC: **Teilweise**
- Positiv: JWT, Rollenprüfung serverseitig, Audit-Log, User-CRUD API.
- Gaps: 2FA, Passwort-Reset, Custom-Role-Management-UI/API, Warehouse-scoped Sichtrechte, vollständiges User-Profil (Abteilung/Standort).

10. PWA/Mobile: **Teilweise**
- Positiv: installierbar, offline-indikator, SW-Update-Hinweis, Offline-Queue.
- Gaps: Dark-Mode/High-Contrast als definierter Betriebsmodus, Gesten/Split-View-Anforderungen nur eingeschränkt abgebildet.

11. Schnittstellen & Integration: **Teilweise bis gut**
- Positiv: External REST API v1, Legacy Full Migration Pipeline, CSV-Imports (Legacy), CSV-Exports (Reports).
- Gaps: generischer CSV/Excel-Massenimport für Kernstammdaten als operativer Frontend/Backend-Flow.

12. Dokumentenmanagement: **Teilweise**
- Positiv: Upload/Versionierung/Download/Delete.
- Gaps: Template-Management, Druck-Integration über Dokumentdomäne hinaus.

13. Systemadministration & Konfiguration: **Nicht erfüllt / stark reduziert**
- Befund: Kein dediziertes Modul für Firmendaten, Nummernkreise, Maßeinheitenverwaltung, Währungen, Steuersätze, Kalender, Backup-Policy-UI.

14. Datenmigration aus Simplimus: **Teilweise bis gut (Phase-Scope)**
- Positiv: strukturierte Migration + Tracking + Raw-Staging.
- Hinweis: Vollabdeckung „146 Legacy-Tabellen fachlich gemappt“ ist im Code nicht nachweisbar; Raw-Staging fängt unmapped Tabellen auf.

15. Feature-Priorisierung (Phasen): **Erfüllt (prozessual)**
- Phase-1..4 Dokumente und Validierungsnachweise vorhanden.

16. Nicht-funktionale Anforderungen: **Teilweise**
- Positiv: stabile Testbasis, PWA Lighthouse 1.0, Request-ID/Error-Format.
- Gaps: keine nachgewiesenen Lasttests für 50+ Benutzer, keine explizite Performance-SLO-Verifikation im CI.

## 6. Empfohlener Fix-Backlog (priorisiert)

1. `P0`: Dokumenten-Path-Traversal schließen (`CR-001`).
2. `P1`: Error/Path-Leakage und Security-Defaults härten (`CR-002` bis `CR-004`).
3. `P2`: Pagination-Standard + Dokumenten-Entity-Validierung + Offline-Strategie Phase-4 (`CR-006` bis `CR-008`).
4. `P2`: Auth/RBAC-Gaps (2FA/Reset/Session-Hardening) und produktive Users-UI schließen (`CR-010`, `CR-011`).
5. `P3`: QA-Coverage mobil, Repo-Hygiene, Dependency-Audit nachhaltig machen (`CR-012` bis `CR-014`).

## 7. Offene Punkte / Annahmen

1. Dieser Review bewertet **gegen Vollumfang von `directstock.md`**. Einige Gaps sind ggf. bewusst „noch nicht in Scope“ (phasenbasiert), bleiben aber gegenüber Masterplan formale Abweichungen.
2. Kein Penetrationstest mit externen Tools durchgeführt; Security-Findings sind Code-/Konfigurationsbasiert.
3. Mobile E2E wurde nicht auf den iOS-Projekten ausgeführt, da Standardskript Desktop-only ist.
