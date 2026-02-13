# DirectStock Phase 4 - Implementierungsplan

## Kurzfassung
Dieses Dokument ist der **decision-complete Umsetzungsplan** für Phase 4 (Features 26-30 aus `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/directstock.md`) und ist als Inhalt für `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/directstock_phase4.md` vorgesehen.  
Planungsstand: **13. Februar 2026**  
Gesamtstatus: **COMPLETED**

## Festgelegte Leitentscheidungen
1. Carrier-Startumfang: **DHL + DPD + UPS**.
2. Externe API-Auth: **Client-Credentials mit JWT-Access-Token**.
3. Forecast-v1: **Baseline + Explainable** (Trend + SMA-basierte Prognose, keine Blackbox-Modelle).
4. Legacy-Cutover: **Parallel Run + Delta Cutover**.

## Scope
In Scope (Phase 4):
1. Feature 26: REST-API für externe Systeme.
2. Feature 27: Legacy-Datenmigration (Simplimus) vollständig.
3. Feature 28: Versanddienstleister-Anbindung (DHL/DPD/UPS).
4. Feature 29: Multi-Warehouse mit übergreifenden Umlagerungen.
5. Feature 30: Erweiterte Analyse (Trends, Prognosen).

Out of Scope (Phase 4):
1. EDI/Punchout/ERP-Spezialprotokolle jenseits REST.
2. Erweiterte ML-Modelle (z. B. Prophet/LSTM) für Forecasting.
3. Cloud-Dokumentenspeicher-Migration.
4. Mobile-native App (außer bestehender PWA).

## Delivery-Strategie
Umsetzung in 6 releasefähigen Batches mit additiven API-Erweiterungen, Alembic-only DB-Änderungen, serverseitigem RBAC, Audit/Request-ID/Error-Format-Konformität und idempotenten Mutationen für offline-relevante Flows.

1. B1 Foundation: Datenmodell + Sicherheitsfundament + Basiskontrakte.
2. B2 External API v1: Auth, Scopes, Read/Write-Contracts.
3. B3 Legacy Migration: Vollimport-Pipeline, Reconciliation, Delta-Cutover-Probe.
4. B4 Shipping: DHL/DPD/UPS Adapter + Shipment-Workflow + Webhooks.
5. B5 Inter-Warehouse Transfers: Dispatch/Receive mit Transit-Status.
6. B6 Analytics: Trends/Forecast + UI + Abschlussverifikation.

## Task-Statusmatrix 4.0.1-4.10.1

| Task | Status | Ergebnisdefinition |
|---|---|---|
| 4.0.1 Phase-4-Baseline und Kontraktrahmen | DONE | Dieses Dokument als Source-of-Truth inkl. Entscheidungen, Scope und Verifikation |
| 4.1.1 Alembic `0011` External API + Integration Clients | DONE | Tabellen für `integration_clients`, `integration_access_logs`, Scope-Zuordnung, Secret-Rotation-Metadaten |
| 4.1.2 Alembic `0012` Legacy Migration Tracking | DONE | Tabellen für `legacy_migration_runs`, `legacy_migration_issues`, `legacy_id_map` |
| 4.1.3 Alembic `0013` Shipping Carrier Domain | DONE | Tabellen für `shipments`, `shipment_events`, Carrier-Statusfelder, Label-Referenzen |
| 4.1.4 Alembic `0014` Inter-Warehouse Transfers | DONE | Tabellen für `inter_warehouse_transfers` + Items inkl. `requested/dispatched/received` Quantitäten |
| 4.1.5 Alembic `0015` Forecast Domain | DONE | Tabellen für `forecast_runs`, `forecast_items` inkl. Güte-/Konfidenzfeldern |
| 4.1.6 Alembic `0016` Legacy Support Records | DONE | Tabelle `legacy_support_records` für migrierte Unterstützungsdaten (Status/Texte/Konfiguration) |
| 4.1.7 Alembic `0017` Legacy Raw Staging | DONE | Tabelle `legacy_raw_records` für vollständige Übernahme aller nicht-gemappten Simplimus-CSV-Tabellen |
| 4.2.1 Integration-Client-Management API | DONE | `/api/integration-clients` CRUD + Secret-Rotate + Scope-Verwaltung (nur `admin`) |
| 4.2.2 Externe API v1 Read Contracts | DONE | `/api/external/v1/products`, `/warehouses`, `/inventory`, `/movements`, `/shipments` |
| 4.2.3 Externe API v1 Write Contracts | DONE | `/api/external/v1/commands/purchase-orders`, `/commands/goods-issues` mit `X-Client-Operation-Id` |
| 4.2.4 External API Security + Rate Limits | DONE | JWT Client-Credentials, Scope-Prüfung serverseitig, Nginx-Rate-Limit auf `/api/external/*` |
| 4.3.1 Legacy Full Import Pipeline | DONE | `scripts/migrate_legacy_full.py` mit echten Pipelines für `master`, `transactions`, `organization`, `support` plus Raw-Staging aller zusätzlichen Legacy-Tabellen, `--mode dry-run|apply|delta`, fail-fast (Exit-Code 2 bei Schemafehlern) |
| 4.3.2 Legacy Reconciliation + Cutover Runbook | DONE | Reproduzierbarer Vergleichsbericht und Delta-Cutover-Anleitung |
| 4.4.1 Carrier Adapter Framework | DONE | Einheitliche Adapter-Schnittstelle `create_label`, `track`, `cancel` mit DHL/DPD/UPS Implementierungen |
| 4.4.2 Shipping Backend APIs | DONE | `/api/shipments` Create/List/Get, `/create-label`, `/cancel`, `/tracking` |
| 4.4.3 Carrier Webhooks | DONE | `/api/carriers/{carrier}/webhook` mit Signature-Verifikation und idempotenter Event-Verarbeitung |
| 4.4.4 Shipping Frontend | DONE | Neue Seite `/shipping` mit Label-Download, Tracking-Timeline, Fehlerstatus |
| 4.5.1 Inter-Warehouse Transfer Backend | DONE | State Machine `draft -> dispatched -> received`, atomare Dispatch-/Receive-Buchungen |
| 4.5.2 Inter-Warehouse Transfer Frontend | DONE | Neue Seite `/inter-warehouse-transfer` inkl. Scan-Workflow und Transitübersicht |
| 4.6.1 Trends/Forecast Backend | DONE | `/api/reports/trends`, `/api/reports/demand-forecast`, Recompute-Endpoint + Batchskript |
| 4.6.2 Trends/Forecast Frontend | DONE | `ReportsPage` um Trend-/Forecast-Ansichten, Filter und CSV-Exporte erweitern |
| 4.7.1 RBAC-/Audit-/Idempotency-Härtung | DONE | Rollenmatrix für neue Endpunkte, vollständige Audit-Einträge, Idempotency-Prefixe erweitert |
| 4.8.1 Backend-Testabdeckung Phase 4 | DONE | Neue Testsuiten für External API, Migration, Shipping, Inter-Warehouse, Forecast |
| 4.8.2 Frontend Unit/E2E Phase 4 | DONE | E2E-Flows für Shipping, Inter-Warehouse und Forecast plus Service-Layer Unit-Tests für neue APIs |
| 4.9.1 Doku-Updates | DONE | Aktualisierung von `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/README.md`, Phase-Doku und Validation-Nachweisen |
| 4.10.1 Gesamtverifikation + Abnahmebericht | DONE | Abschlussnachweis in `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/docs/validation/phase4-acceptance.md` |

## Offene Punkte aus Audit 2026-02-13 (geschlossen)
1. Legacy-Komplettmigration war zuvor teilweise Placeholder (`transactions`, `organization`, `support`).
Status: **RESOLVED** durch produktive Domain-Importer, Reconciliation-Issues, Persistenz für Support-Daten und generisches Raw-Staging für alle übrigen Legacy-CSV-Tabellen.
2. Transitbestand war nicht explizit in Dashboard/Reports sichtbar.
Status: **RESOLVED** durch neue KPI-Felder für Inter-Warehouse-Transit in `/api/dashboard/summary` und `/api/reports/kpis`.
3. Inter-Warehouse-Frontend hatte keinen expliziten Scan-Workflow.
Status: **RESOLVED** durch Scan-gesteuerte Vorbelegung für Produkt, Quell-Bin und Ziel-Bin.
4. Frontend-Unit-Abdeckung für neue Service-Layer war zu dünn.
Status: **RESOLVED** durch ergänzte Unit-Tests für `shippingApi` und `interWarehouseTransfersApi`.

## Öffentliche API-/Interface-Änderungen (additiv)

### Backend HTTP APIs
1. `POST /api/external/token`  
   OAuth2-ähnlicher Client-Credentials-Flow (`client_id`, `client_secret`, `scope`) mit JWT-Token (TTL: 30 Minuten).
2. `GET /api/external/v1/products`
3. `GET /api/external/v1/warehouses`
4. `GET /api/external/v1/inventory`
5. `GET /api/external/v1/movements`
6. `GET /api/external/v1/shipments`
7. `POST /api/external/v1/commands/purchase-orders`
8. `POST /api/external/v1/commands/goods-issues`
9. `POST /api/shipments`
10. `POST /api/shipments/{shipment_id}/create-label`
11. `GET /api/shipments/{shipment_id}/tracking`
12. `POST /api/shipments/{shipment_id}/cancel`
13. `POST /api/carriers/{carrier}/webhook`
14. `GET /api/inter-warehouse-transfers`
15. `POST /api/inter-warehouse-transfers`
16. `POST /api/inter-warehouse-transfers/{id}/dispatch`
17. `POST /api/inter-warehouse-transfers/{id}/receive`
18. `POST /api/inter-warehouse-transfers/{id}/cancel`
19. `GET /api/reports/trends`
20. `GET /api/reports/demand-forecast`
21. `POST /api/reports/demand-forecast/recompute`

### Header- und Idempotency-Verträge
1. Mutierende External-Command-Endpunkte und Inter-Warehouse-Dispatch/Receive unterstützen `X-Client-Operation-Id`.
2. Konfliktantworten bleiben standardisiert: HTTP `409` + `ApiError.details`.
3. Fehlerformat bleibt unverändert: `code`, `message`, `request_id`, `details`.

### Frontend-Typen und Routen
1. Neue Typen in `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend/src/types.ts` für `Shipment`, `ShipmentEvent`, `InterWarehouseTransfer`, `ForecastRow`.
2. Neue Routen:
   `/shipping` (Rollen: `admin|lagerleiter|versand`)  
   `/inter-warehouse-transfer` (Rollen: `admin|lagerleiter|lagermitarbeiter`)
3. `ReportsPage` erweitert um `trends` und `demand-forecast`.

## Implementierungsdetails pro Workstream

### A) External API v1
1. Neue Routerstruktur: `backend/app/routers/external_api.py` + `backend/app/routers/integration_clients.py`.
2. Scope-Matrix fix:
   `products:read`, `warehouses:read`, `inventory:read`, `movements:read`, `shipments:read`, `orders:write`.
3. Auth-Validierung trennt interne User-JWTs von Integrations-Client-JWTs.
4. OpenAPI-Dokumentation mit Beispielen für jeden v1-Endpunkt.
5. Nginx-Rate-Limit auf `/api/external/*` (burst-fähig, read/write getrennt).

### B) Legacy-Komplettmigration
1. Neues Skript: `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/scripts/migrate_legacy_full.py`.
2. Domains und Reihenfolge:
   `master -> transactions -> organization -> support`.
3. Importmodi:
   `dry-run` (nur Validation), `apply` (voller Import), `delta` (nur Änderungen seit Referenzzeitpunkt).
4. Jede Domain produziert Reconciliation-KPIs:
   Record Count Match, Nullability Violations, FK Integrity, Dedupe Count.
5. Nicht explizit gemappte Legacy-Tabellen werden vollständig und idempotent in `legacy_raw_records` übernommen.
6. Cutover-Prozess (verbindlich):
   Parallel Run 2 Wochen, tägliche Delta-Synchronisation, Freeze-Fenster, Final Delta, Smoke + Abnahme.

### C) Carrier-Integration
1. Adapter-Pattern in `backend/app/services/carriers/*`.
2. Carrier-Implementierungen:
   `dhl.py`, `dpd.py`, `ups.py`, plus `sandbox_stub.py`.
3. Label-Erzeugung speichert Dokument als `Document`-Entity (keine neue Dokumentenablage).
4. Tracking-Ereignisse werden als `shipment_events` historisiert.
5. Webhooks sind signaturgeprüft, idempotent und auditiert.

### D) Inter-Warehouse Transfers
1. Bestehende `/api/stock-transfers` bleiben für intra-lokale Bin-Umlagerungen unverändert.
2. Neue Domäne für standortübergreifende Transfers mit State Machine:
   `draft -> dispatched -> received`; `draft -> cancelled`.
3. Dispatch bucht Abgang im Quelllager (`inter_warehouse_dispatch` Movement).
4. Receive bucht Zugang im Ziellager (`inter_warehouse_receive` Movement).
5. Transitbestand wird über offene `dispatched` Positionen berechnet und im Dashboard/Reports sichtbar.

### E) Trends & Forecast
1. Forecast-v1 Algorithmus:
   Daily Demand aus `goods_issue`-Bewegungen, SMA(28), Trendslope über 56 Tage.
2. Horizons:
   7, 30, 90 Tage.
3. Explainability-Felder pro Ergebnis:
   `historical_mean`, `trend_slope`, `confidence_score`, `history_days_used`.
4. Neues Batchskript:
   `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/scripts/run_demand_forecast.py`.
5. `ReportsPage` zeigt Tabellen + einfache Sparkline-Darstellung ohne neue Heavy-UI-Dependencies.

## Testfälle und Szenarien

### Backend
1. `test_external_api_auth.py`: Token-Flow, Scope-Denials, Expiry, Secret-Rotation.
2. `test_external_api_contract.py`: Read/Write Contracts, Pagination, Filter, Error-Format.
3. `test_legacy_migration_full.py`: Dry-Run Validation, Apply Idempotenz, Delta-Konsistenz.
4. `test_shipping_carriers.py`: Label/Track/Cancel für DHL/DPD/UPS (Sandbox Mocks + Fehlerpfade).
5. `test_inter_warehouse_transfers.py`: Dispatch/Receive, Teilmengen, Konflikte, doppelte Buchungen.
6. `test_reports_forecast.py`: Trend- und Forecast-Formeln, Edge Cases mit dünner Datenlage.
7. `test_offline_idempotency_phase4.py`: neue Prefixe und Replay-Verhalten.

### Frontend Unit
1. Service-Layer Tests für neue APIs.
2. Rollen-/Routeguard-Tests für `/shipping` und `/inter-warehouse-transfer`.
3. Reports-Rendering-Tests für Trend/Forecast-Komponenten.

### Frontend E2E
1. `shipping-flow.spec.ts`: Goods-Issue -> Shipment -> Label -> Tracking.
2. `inter-warehouse-transfer-flow.spec.ts`: Draft -> Dispatch -> Receive.
3. `reports-forecast-flow.spec.ts`: Filtern, Forecast-Anzeige, CSV-Export.

### Migrations- und Betriebsverifikation
1. Full Dry-Run gegen Legacy-Fixture.
2. Reconciliation-Bericht ohne Blocker.
3. Delta-Cutover-Probe vollständig reproduzierbar dokumentiert.

## Verifikations-Checkliste (Phase 4)
1. `cd /Users/tobiasmorixbauer/Documents/GitHub/DirectStock/backend && ./.venv/bin/python -m pytest -q`
2. `cd /Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend && npm run test`
3. `cd /Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend && npm run build`
4. `cd /Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend && npm run test:e2e`
5. `cd /Users/tobiasmorixbauer/Documents/GitHub/DirectStock && ./scripts/lighthouse_pwa.sh`
6. `cd /Users/tobiasmorixbauer/Documents/GitHub/DirectStock && python3 scripts/migrate_legacy_full.py --mode dry-run --domain all --source /Users/tobiasmorixbauer/Documents/GitHub/DirectStock/backend/tests/fixtures/legacy_full`
7. `cd /Users/tobiasmorixbauer/Documents/GitHub/DirectStock && python3 scripts/run_demand_forecast.py`
8. Runtime-Smoke: `/health`, `/api/health`, `/api/docs`, External API Token + Sample Read Call.

## Risiken und Gegenmaßnahmen
1. Legacy-Datenqualität: harte Validierungsregeln, Reconciliation-Gates, kein Cutover bei roten Gates.
2. Carrier-API-Volatilität: Adapter-Isolation + Sandbox-Suite + Retry/Dead-letter-Handling.
3. Transit-Konsistenz: Dispatch/Receive atomar, doppelte Verarbeitung über Idempotency blockieren.
4. Forecast-Akzeptanz: Explainability-Felder verpflichtend, keine Blackbox-Heuristik in v1.
5. Performance: Pagination für neue Listenendpunkte, Batchläufe asynchron/scriptbasiert.

## Definition of Done (Phase 4)
1. Alle Tasks 4.0.1-4.10.1 umgesetzt.
2. Keine Breaking Changes an bestehenden API-Verträgen.
3. Relevante Tests grün und reproduzierbar.
4. Legacy-Migration-Cutover-Probe erfolgreich dokumentiert.
5. Doku aktualisiert:
   `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/README.md`  
   `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/directstock_phase4.md`  
   `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/docs/validation/phase4-acceptance.md`  
   `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/docs/validation/phase4-migration-rehearsal.md`

## Annahmen und Defaults
1. Sprache: Deutsch.
2. Zeitbezug: UTC.
3. Externe API bleibt unter `/api/external/v1` versioniert.
4. Carrier v1: DHL/DPD/UPS, primär Sandbox-erst, Live per ENV-Flag.
5. Forecast v1 ist erklärbar und konservativ, nicht ML-lastig.
6. Cutover folgt verbindlich dem Parallel-Run- und Delta-Muster.

## Finale Abnahme - Phase 4 abgeschlossen (2026-02-13, UTC)

Status: **PASS**

Durchgeführter End-to-End-Lauf auf frischer Datenbank:

1. `alembic upgrade head` auf neuer SQLite-DB.
2. `python scripts/migrate_legacy_full.py --mode apply --domain all --source backend/tests/fixtures/legacy_full`.

Ergebnis Kernlauf:

1. `master`: `processed=3`, `created=3`, `updated=0`, `errors=0`
2. `transactions`: `processed=8`, `created=8`, `updated=0`, `errors=0`
3. `organization`: `processed=2`, `created=2`, `updated=0`, `errors=0`
4. `support`: `processed=2`, `created=2`, `updated=0`, `errors=0`

Persistenzprüfung nach Lauf:

1. Produkte: `3`
2. Purchase Orders: `2`
3. Purchase Order Items: `2`
4. Goods Issues: `2`
5. Goods Issue Items: `2`
6. Benutzer: `2`
7. Legacy Support Records: `2`
8. Legacy Raw Records: `0` (kein zusätzliches unmapped CSV im Basis-Fixture)

Zusatznachweis Komplettmigration (unmapped Legacy-Tabellen):

1. Lauf mit zusätzlicher Legacy-Datei `app_vars.csv` (`--mode apply --domain support`) ausgeführt.
2. Ergebnis: `processed=4`, `created=2`, `updated=2`, `errors=0`.
3. Persistenz: `legacy_raw_records=2`.

Damit ist Feature 27 (Simplimus-Komplettmigration) in Phase 4 mit typed Import plus vollständigem Raw-Staging für nicht gemappte Legacy-Tabellen umgesetzt und verifiziert.
