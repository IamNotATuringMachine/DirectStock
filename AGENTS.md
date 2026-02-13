# AGENTS.md

Version: 2026-02-13 (Phase 4 baseline complete)
Gilt fuer: gesamtes Repository `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock`

## 1. Mission
Dieses Repo wird von menschlichen Entwicklern und Coding-Agents gemeinsam gepflegt.
Ziel jedes Agentenbeitrags: **korrekte, sichere, testbare, reproduzierbare Aenderungen** mit minimalem Risiko fuer Regressionen.

## 2. Non-Negotiables (immer)
1. Keine destruktiven Aktionen ohne explizite Freigabe: kein `git reset --hard`, kein `git checkout --`, kein Loeschen produktiver Daten.
2. Bestehende APIs nur **additiv** erweitern, ausser eine Breaking-Change-Freigabe liegt explizit vor.
3. DB-Schema-Aenderungen nur ueber Alembic-Migrationen.
4. Security-Basics duerfen nicht abgeschwaecht werden (Auth, RBAC, Audit, Request-ID, Error-Format).
5. Offline-relevante Mutationen muessen Idempotency unterstuetzen (`X-Client-Operation-Id`) oder kompatibel bleiben.
6. Vor Abschluss immer relevante Tests/Builds ausfuehren und Ergebnisse dokumentieren.
7. Keine Secrets in Code, Commits oder Logs. `.env` bleibt lokal.

## 3. Arbeitsmodus fuer Agents (aktueller Standard)
1. Kontext laden: betroffene Dateien, bestehende Kontrakte, Testlage, Phase-Dokumente.
2. Plan in kleinen, verifizierbaren Schritten erstellen.
3. Implementieren mit kleinen Diffs und klaren Commit-faehigen Einheiten.
4. Lokal verifizieren (mindestens betroffene Test-Suites).
5. Doku/Status aktualisieren, wenn Verhalten, API oder Betriebsablauf geaendert wurde.
6. Ergebnis mit Risiken, offenen Punkten und naechsten sinnvollen Schritten berichten.

## 4. Repo-Topologie
- `backend/`: FastAPI, SQLAlchemy 2.x, Alembic, Auth/RBAC, Audit, Idempotency-Middleware
- `frontend/`: React 19 + Vite 6 + TypeScript + TanStack Query + Zustand + PWA + Offline-Queue
- `nginx/`: Entry-Routing fuer `/` und `/api/*`
- `scripts/`: Seed, Legacy-Import (`migrate_legacy_full.py`), Forecast-Batch (`run_demand_forecast.py`), Lighthouse/PWA-Checks, Alert-Evaluierung (`run_alert_checks.py`)
- `docs/validation/`: Betriebs- und Verifikationsnachweise inkl. Phase-2 bis Phase-4-Abnahmen
- `directstock.md`: Masterplan
- `directstock_phase1.md`: Phase-1-Status
- `directstock_phase2.md`: Phase-2-Statusmatrix und Verifikationsstand
- `directstock_phase3.md`: Phase-3-Statusmatrix und Verifikationsstand
- `directstock_phase4.md`: Phase-4-Statusmatrix und Abnahme

## 5. Source-of-Truth fuer Kontrakte
1. Backend-Schemas (`backend/app/schemas/*`) definieren API-Response/Request-Vertraege.
2. Frontend-Typen (`frontend/src/types.ts`) muessen dazu konsistent sein.
3. Phase-Kontrakte/Status stehen in `directstock_phase4.md` (historische Details in `directstock_phase1.md` bis `directstock_phase3.md`).
4. Tests sind verbindlicher Teil der Spezifikation, besonders fuer Auth, RBAC, Inventory, Operations, Alerts, Reports, External API, Shipping, Inter-Warehouse und Offline-Idempotency.

## 6. Build-, Test- und Runtime-Kommandos

### Dev Runtime
- `docker compose up --build`
- Optional Hot Reload: `docker compose -f docker-compose.dev.yml up --build`

### Backend lokal
- `cd backend`
- `python3 -m venv .venv && source .venv/bin/activate`
- `pip install -e .[dev]`
- `python -m pytest -q`

### Frontend lokal
- `cd frontend`
- `npm install`
- `npm run test`
- `npm run build`
- `npm run test:e2e` (gegen laufenden Stack auf `http://localhost:8080`)

### Production-Verifikation
- `docker compose -f docker-compose.prod.yml up -d --build`
- Smoke: `/health`, `/api/health`, `/api/docs`, Login
- `./scripts/lighthouse_pwa.sh` (PWA Score >= 0.90)

### Phase-4 Acceptance Referenz (letzter Stand)
- Backend: `76 passed`
- Frontend Unit: `13 passed`
- Frontend E2E: `16 passed`
- Lighthouse/PWA: `1.00`
- Nachweise: `docs/validation/phase2-acceptance.md`, `docs/validation/phase3-acceptance.md`, `docs/validation/phase4-acceptance.md`

## 7. Architektur-Guardrails

### Backend
1. Endpunkte unter `/api/*`, Health unter `/health` und `/api/health`.
2. Fehlerformat einheitlich halten (`ApiError`: `code`, `message`, `request_id`, `details`).
3. Mutierende Endpunkte (`POST/PUT/PATCH/DELETE`) muessen Audit-Eintraege erzeugen.
4. RBAC serverseitig pruefen, nie nur im Frontend.
5. Zeitbezug in UTC.
6. Phase-2 bis Phase-4 Module bleiben stabil und additiv: `customers`, `suppliers`, `purchasing`, `inventory_counts`, `reports`, `alerts`, `idempotency`, `abc`, `purchase_recommendations`, `picking`, `returns`, `workflows`, `documents`, `audit_log`, `external_api`, `integration_clients`, `shipping`, `inter_warehouse_transfers`, `forecast`.
7. Offline-relevante Mutationen duerfen ohne gueltige Konfliktbehandlung keine Doppelbuchungen erzeugen.

### Datenbank
1. Fachliche Unique-Constraints aus den Migrationen `0001` bis `0006` beibehalten.
2. Indexe fuer Bewegungs-/Bestandsabfragen erhalten (`product_id`, `bin_location_id`, `performed_at`, `status`, `expiry_date`).
3. Migrationen vorwaerts-sicher, idempotent und reviewbar halten.

### Frontend
1. App-Shell responsiv halten, Sidebar-Collapse darf Mobile nicht brechen.
2. Kritische Flows mit stabilen `data-testid`-Attributen absichern.
3. API-Zugriff nur ueber Service-Layer (`frontend/src/services/*`).
4. PWA-UX erhalten: Install-Hinweis, Offline-Indikator, Update-Banner.
5. Offline-Queue zentral in `frontend/src/services/offlineQueue.ts` halten, keine parallelen Queue-Implementierungen einfuehren.
6. Rollenbasierte Navigation/Routeguards konsistent zu Backend-RBAC pflegen.

## 8. Seed/Import/Jobs
1. Seed muss idempotent und deterministisch sein.
2. Legacy-Import (`scripts/migrate_legacy_full.py`) bleibt **fail-fast** fuer Vertragsdateien, wenn Pflichtspalten fehlen (Exit-Code `2`), und staged nicht-gemappte Legacy-CSV-Tabellen in `legacy_raw_records`.
3. Positiver Referenzpfad fuer valides Fixture muss idempotenten Apply/Upsert nachweisen (`dry-run|apply|delta`).
4. Alert-Batchlauf (`scripts/run_alert_checks.py`) muss ohne Seiteneffekte ausserhalb der Alert-Domaene bleiben.

## 9. Definition of Done (DoD)
Eine Aufgabe gilt nur als fertig, wenn:
1. Implementierung abgeschlossen und lauffaehig ist.
2. Relevante Tests gruen sind.
3. Keine offensichtlichen Contract-Breaks bestehen.
4. Doku aktualisiert ist (`README.md`, `directstock_phase4.md`, `docs/validation/*` sofern betroffen).
5. Betriebsrelevante Schritte reproduzierbar beschrieben sind.

## 10. Minimaler Abschlussbericht je Agent-Task
Jeder Agent liefert am Ende:
1. Geaenderte Dateien.
2. Was funktional geaendert wurde.
3. Ausgefuehrte Verifikation inkl. Resultaten.
4. Bekannte Rest-Risiken/offene Punkte.
5. Optional: naechste 1-3 sinnvolle Schritte.

## 11. Git- und Review-Disziplin
1. Kleine, thematisch klare Diffs bevorzugen.
2. Keine "drive-by" Refactors ausser direkt erforderlich.
3. Keine toten TODOs ohne Ticket/Context.
4. Bei Unsicherheit ueber fachliche Regeln: Annahmen explizit machen statt stillschweigend raten.

## 12. Performance- und Zuverlaessigkeits-Baseline
1. N+1 Queries vermeiden (gezielte Joins/Prefetching).
2. Teure Listen-Endpunkte paginierbar halten.
3. Frontend-Ladezustaende und Fehlerpfade sichtbar machen.
4. Build-Warnungen nicht ignorieren, wenn sie Laufzeit- oder Bundle-Risiken anzeigen.
5. Query-/Report-Endpunkte mit Filter- und Exportpfaden performant halten.

## 13. Security- und Compliance-Baseline
1. Passwort-Hashing via bcrypt/passlib unveraendert sicher halten.
2. JWT Claims/TTL nicht aufweichen ohne explizite Freigabe.
3. Input validieren (Pydantic/TypeScript), Output escapen wo noetig.
4. Abhaengigkeiten nur minimal und begruendet erweitern.
5. Idempotency- und Conflict-Responses (`409` + `details`) nicht aufweichen.

## 14. Phase-4 Moduluebersicht (aktiver Bestand)
- Backend-Router: `auth`, `users`, `products`, `warehouses`, `inventory`, `operations`, `dashboard`, `customers`, `suppliers`, `product_settings`, `purchasing`, `inventory_counts`, `reports`, `alerts`, `abc`, `purchase_recommendations`, `picking`, `returns`, `workflows`, `documents`, `audit_log`, `external_api`, `integration_clients`, `shipping`, `inter_warehouse_transfers`
- Frontend-Seiten: `Products`, `ProductForm`, `GoodsReceipt`, `GoodsIssue`, `StockTransfer`, `Inventory`, `InventoryCount`, `Purchasing`, `Reports`, `Alerts`, `Dashboard`, `Scanner`, `Warehouse`, `Picking`, `Returns`, `Approvals`, `Documents`, `AuditTrail`, `Shipping`, `InterWarehouseTransfer`
- Validation-Dokumente: `docs/validation/scanner-verification.md`, `docs/validation/phase2-acceptance.md`, `docs/validation/phase3-acceptance.md`, `docs/validation/phase4-acceptance.md`, `docs/validation/phase4-migration-rehearsal.md`

---
Bei Konflikten gilt: Sicherheit und Datenintegritaet vor Geschwindigkeit.
