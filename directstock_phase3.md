## DirectStock Phase 3 - Implementierungsstatus

Stand: **13. Februar 2026**
Gesamtstatus: **DONE**

### Legende
- `DONE`: vollständig umgesetzt und verifiziert
- `IN PROGRESS`: in Umsetzung
- `OPEN`: noch nicht begonnen

### Scope
- In Scope: Features **19-25** aus `directstock.md` (Phase 3 Optimierung & Automatisierung)
  - 19 ABC-Analyse und automatische Klassifizierung
  - 20 Automatische Bestellvorschlaege
  - 21 Kommissionier-Optimierung (Wegoptimierung, Batch-Picking)
  - 22 Retouren-Management
  - 23 Vollstaendiger Audit Trail
  - 24 Erweiterte Workflows und Genehmigungen
  - 25 Dokumentenmanagement
- Out of Scope:
  - Legacy-Organisationsdatenmigration (Abschnitt 14 Phase 3)
  - Externe Integrationen (Carrier/ERP/EDI)
  - Cloud-Document-Storage (S3 etc.)

### Delivery-Strategie
- Umsetzung in **5 inkrementellen, releasefaehigen Batches** (B1-B5).
- Jede Teilabnahme verlangt additive API-Erweiterungen, Alembic-only DB-Aenderungen, serverseitiges RBAC, Idempotency-Kompatibilitaet, grüne Tests und aktualisierte Doku.

### Task-Statusmatrix 3.0.1-3.9.1

| Task | Status | Kurzbegründung |
|---|---|---|
| 3.0.1 Phase-3-Baseline und Kontraktrahmen | DONE | Dieses Dokument als Source-of-Truth fuer Scope, Reihenfolge und Verifikation |
| 3.1.1 Alembic `0008` ABC + Bestellvorschlaege | DONE | Tabellen fuer ABC-Runs/-Items und Purchase-Recommendations |
| 3.1.2 Alembic `0009` Picking + Returns | DONE | Tabellen fuer Pick-Waves/Tasks und Return-Orders/-Items |
| 3.1.3 Alembic `0010` Workflows + Documents + Audit-v2 | DONE | Approval-Tabellen, Dokumente, Audit-Log-Erweiterungen |
| 3.1.4 Rollen-/Typ-Erweiterung `auditor` | DONE | Backend-Role-Seed und Frontend-`RoleName` additiv erweitern |
| 3.2.1 ABC-Backend (Recompute + Listing) | DONE | Endpunkte `/api/abc-classifications/*`, 90-Tage-Regel und ABC-Klassengrenzen |
| 3.2.2 Bestellvorschlags-Backend (Generate/List/Convert/Dismiss) | DONE | Regeln `target_stock/deficit/round-up`, PO-Konvertierung |
| 3.2.3 Purchasing-Frontend Tabs ABC + Bestellvorschlaege | DONE | Erweiterung `PurchasingPage` um Phase-3-Teilmodule |
| 3.2.4 Job-Skript ABC-Klassifizierung | DONE | `scripts/run_abc_classification.py` fuer reproduzierbaren Batchlauf |
| 3.3.1 Picking-Backend (Waves/Tasks + Routing) | DONE | Endpunkte `/api/pick-waves`, `/api/pick-tasks`, deterministische Wegoptimierung |
| 3.3.2 Picking-Frontend + Scanner-Task-Abschluss | DONE | Neue `PickingPage` mit stabilen `data-testid` |
| 3.4.1 Returns-Backend (CRUD + Status + Movement-Typen) | DONE | `return_receipt`, `return_restock`, `return_scrap`, `return_supplier` |
| 3.4.2 Returns-Frontend | DONE | Neue `ReturnsPage` mit Item-Entscheidungsworkflow |
| 3.5.1 Approval-Engine Backend (Rules + Requests + Actions) | DONE | Policy-getrieben fuer `purchase_order` und `return_order` |
| 3.5.2 Approval-Frontend | DONE | Neue `ApprovalsPage` fuer Pending/Approve/Reject |
| 3.6.1 Dokumentenmanagement Backend | DONE | Upload/List/Download/Delete mit Versionierung und MIME/Size-Gates |
| 3.6.2 Dokumentenmanagement Frontend | DONE | Neue `DocumentsPage` inkl. Upload und Entity-Filter |
| 3.7.1 Audit-Trail v2 Backend + Read-Endpoint | DONE | Snapshot-Felder, Redaction, `/api/audit-log` mit Filtern |
| 3.7.2 Audit-Trail Frontend | DONE | Neue `AuditTrailPage` (Filter, Pagination, Lesesicht) |
| 3.8.1 Reports/KPI-Erweiterung Backend | DONE | `/api/reports/returns`, `/api/reports/picking-performance`, `/api/reports/purchase-recommendations`, KPI-Felder |
| 3.8.2 Reports-Frontend Erweiterungen | DONE | UI fuer neue Reports/KPIs und CSV-Exporte |
| 3.8.3 Offline/Idempotency Scope-Erweiterung | DONE | Prefixe fuer Picking/Returns im Backend + Offline-Queue-Scopes im Frontend |
| 3.9.1 Gesamtverifikation, Doku und Abnahmereport | DONE | Vollstaendige Verifikation (Backend/Frontend/E2E/Lighthouse) inkl. Phase-3-E2E-Suite dokumentiert |

### Offene Punkte (aktuell)
- Keine offenen Punkte fuer Features 19-25.

### Nachlauf: Geschlossene Review-Punkte
1. Audit-v2 Before/After-Snapshots + Feld-Diff im Middleware-Pfad implementiert.
2. Picking-Scanner-Abschluss in `PickingPage` mit stabilem Scan-Workflow (`Bin -> Produkt`) und `data-testid` ergaenzt.
3. Approvals-UI auf RBAC-Matrix korrigiert (Rule-Management nur `admin|lagerleiter`).
4. Phase-3-E2E-Flows ergaenzt:
   - `frontend/tests/e2e/picking-wave-flow.spec.ts`
   - `frontend/tests/e2e/returns-flow.spec.ts`
   - `frontend/tests/e2e/approvals-flow.spec.ts`
   - `frontend/tests/e2e/documents-attachment-flow.spec.ts`
   - `frontend/tests/e2e/audit-log-visibility.spec.ts`
5. README Phase-3-Snapshot auf "umgesetzt" harmonisiert.

### Batch-Abnahmekriterien (pro Batch verbindlich)
1. Additive API-Erweiterungen ohne Breaking-Changes.
2. Datenbankschema-Aenderungen ausschließlich per Alembic-Migration.
3. RBAC serverseitig abgesichert; Frontend nur komplementaer.
4. Offline-relevante Mutationen idempotent (`X-Client-Operation-Id`) oder kompatibel.
5. Relevante Tests grün (Backend/Frontend/E2E je nach Batch-Scope).
6. Dokumentation und Verifikationsstand aktualisiert.

### Verifikations-Checkliste (Phase 3)
- `cd backend && ./.venv/bin/python -m pytest -q`
- `cd frontend && npm run test`
- `cd frontend && npm run build`
- `cd frontend && npm run test:e2e`
- `./scripts/lighthouse_pwa.sh`
- Batchskripte:
  - `python3 scripts/run_abc_classification.py`
  - `python3 scripts/run_alert_checks.py`

### Verifikationsstand (aktueller Batch)
- `backend`: `64 passed` (`backend/.venv/bin/python -m pytest -q`)
- `frontend unit`: `13 passed` (`cd frontend && npm run test`)
- `frontend build`: erfolgreich (`cd frontend && npm run build`)
- `frontend e2e`: erfolgreich (`cd frontend && npm run test:e2e` -> `13 passed`)
- `lighthouse/pwa`: `1.00` (`./scripts/lighthouse_pwa.sh`, Schwellwert `>= 0.90`)  
  Artefakte: `artifacts/lighthouse/lighthouse.report.json`, `artifacts/lighthouse/lighthouse.report.html`
- Runtime-Health: `200` auf `/health`, `/api/health`, `/api/docs`
- `abc-batch`: erfolgreich (`docker compose exec -T backend python /app/scripts/run_abc_classification.py` -> `run_id=1, items=6`)
- `alert-batch`: erfolgreich (`docker compose exec -T backend python /app/scripts/run_alert_checks.py` -> `created=0`)

### Risiken und Abhängigkeiten
1. **Scope-Breite**: Phase-3 kombiniert 7 große Module; Batch-Disziplin ist zwingend.
2. **Konsistenzrisiko**: Picking/Returns greifen auf Bestandslogik zu; Regressionstests in `inventory/operations` erforderlich.
3. **Audit-Datenmenge**: Snapshot-Felder koennen Audit-Volumen erhöhen; Filter/Pagination obligatorisch.
4. **Offline-Konflikte**: Neue Mutationen muessen in bestehende Idempotency-/Replay-Logik passen.
5. **UI-Komplexitaet**: Neue Seiten + Rollenmatrix erfordern stabile Route-/Nav-Guards.

### Definition of Done (Phase 3)
1. Implementierung der in-scope Tasks 3.0.1-3.9.1 abgeschlossen.
2. Vollständige Verifikation ohne rote Tests.
3. Keine offensichtlichen Contract-Breaks.
4. Doku aktualisiert (`README.md`, `directstock_phase3.md`, `docs/validation/phase3-acceptance.md`).
5. Betriebsrelevante Schritte reproduzierbar dokumentiert.

### Annahmen/Defaults
1. Sprache bleibt Deutsch.
2. Zeitbezug bleibt UTC.
3. Dokumentenablage V1 lokal: `/app/data/documents`.
4. Approval-V1 gilt nur fuer `purchase_order` und `return_order`.
5. Performance-Zielwerte:
   - Pick-Wave-Generierung (1000 Tasks) < 2s
   - Bestellvorschlagslauf (5000 SKU) < 60s
   - API-P95 fuer neue Listenendpunkte < 500ms
