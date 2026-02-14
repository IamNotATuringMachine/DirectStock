# DirectStock Phase 5 - Implementierungsplan

## Kurzfassung
Dieses Dokument ist der **decision-complete Umsetzungsplan** fuer Phase 5 (Features 31-38 aus `directstock.md`) und dient als Source-of-Truth fuer die naechste Ausbauphase.  
Planungsstand: **14. Februar 2026**  
Gesamtstatus: **IMPLEMENTED (validated)**

## Abnahme-Update 2026-02-14
1. B1-B8 wurden umgesetzt (additiv, Alembic-only fuer Schema-Aenderungen).
2. Produktionsmigrationen `0018-0023` laufen auf Postgres und SQLite durch.
3. Validierung:
   - Backend: `99 passed`
   - Frontend Unit: `30 passed`
   - Frontend Build: `success`
   - Frontend E2E Vollsuite: `74 passed`, `4 skipped`
   - Lighthouse PWA: `1.00`
   - Prod-Smoke: `/health`, `/api/health`, `/api/docs`, Login `200`
4. Nachweis: `docs/validation/phase5-acceptance.md`

## Closed Points (Update 2026-02-14)
1. ZUGFeRD Export ist auf PDF/A-3 mit eingebettetem XML umgestellt und testseitig verifiziert.
2. Strict-E-Invoice deckt jetzt positive und negative KoSIT-Pfade reproduzierbar ab.
3. Abnahme- und Statusdokumente sind wieder auf denselben finalen Stand harmonisiert.

## Festgelegte Leitentscheidungen
1. RBAC wird permission-basiert umgesetzt (`page.<slug>.view`, `module.<slug>.<action>`), nicht mehr mit statischen Frontend-Rollenlisten.
2. Preislogik ist netto-fuehrend; brutto wird aus USt-Satz berechnet.
3. Steuerraum v1 ist Deutschland-first (EUR, USt 19/7/0), aber technisch auf weitere Laender erweiterbar.
4. Lieferschein bleibt auf bestehender `GoodsIssue`-Domaene aufgebaut (kein paralleles Delivery-Modul in v1).
5. E-Rechnung v1 liefert XRechnung/ZUGFeRD-Dateierzeugung und Validierung, ohne direkte Provider-Uebertragung.
6. Dashboard wird user- und rollenbasiert konfigurierbar, mit Admin-Policies fuer erlaubte Cards.
7. Guides werden doppelt ausgerollt: In-App-Kontexthilfe plus strukturierte Doku unter `docs/guides/`.

## SOTA- und Korrektheitscheck (Planung)
1. Additive Evolution: bestehende APIs bleiben kompatibel, neue Vertraege nur additiv.
2. Security by default: serverseitige Permission-Pruefung, keine reine UI-Authorization.
3. Compliance-ready: Audit, Idempotency und einheitliches Error-Format (`ApiError`) bleiben verpflichtend.
4. Domain-Entkopplung: Pricing, Sales/Invoice, Dashboard-Config und Guides werden als eigenstaendige Workstreams gefuehrt.
5. Test-First-Absicherung: neue Backend-/Frontend-Vertraege erhalten dedizierte Unit-, Integrations- und E2E-Szenarien.

## Scope
In Scope (Phase 5):
1. Feature 31: Darkmode + persistente Theme-Preferences.
2. Feature 32: Dynamisches RBAC mit Rollen-/Permission-Management.
3. Feature 33: Produktpreise netto/brutto inkl. USt-Logik.
4. Feature 34: Kundenspezifische Preise mit Gueltigkeitszeitraeumen.
5. Feature 35: Sales-Order-, Lieferschein- und Rechnungsworkflow inkl. Teilrechnung.
6. Feature 36: E-Rechnungsvorbereitung (XRechnung + ZUGFeRD).
7. Feature 37: Guides fuer bestehende und neue Features.
8. Feature 38: Konfigurierbares Dashboard inkl. Rollen-Templates.

Out of Scope (Phase 5):
1. Direkte E-Invoice-Provider-Anbindung (Transport/Gateway).
2. Globales Multi-Tax-/Multi-Currency-Regelwerk (ueber DE-first hinaus).
3. Vollstaendige Neuimplementierung der Delivery-Domaene neben `GoodsIssue`.
4. KI-gestuetzte adaptive Dashboard-Layouts.

## Delivery-Strategie
Umsetzung in 8 releasefaehigen Batches mit Alembic-only Schema-Aenderungen, additiven APIs und schrittweiser Frontend-Aktivierung hinter stabilen Vertraegen.

1. B1 Foundation: Migrations-Backbone 0018-0023 + Contract-Rahmen.
2. B2 RBAC Core: Permission-Model, Router, Dependency-Switch, Frontend-Guards.
3. B3 UX Core: UI-Preferences, Darkmode, Dashboard-Policy Backend.
4. B4 Dashboard UX: konfigurierbare Cards, Rollen-Templates, Benutzer-Customizing.
5. B5 Pricing: Produktbasispreise + Kundenpreise + Preisauflosung.
6. B6 Sales & Invoice: Sales Orders, Teilrechnung, Lieferschein ueber GoodsIssue.
7. B7 E-Invoice & Guides: XRechnung/ZUGFeRD-Exports und Feature-Guides.
8. B8 Hardening: Audit/Idempotency, Volltests, Dokumentation und Abnahme.

## Task-Statusmatrix 5.0.1-5.11.1

| Task | Status | Ergebnisdefinition |
|---|---|---|
| 5.0.1 Phase-5-Baseline und Kontraktrahmen | DONE | Dieses Dokument als Source-of-Truth inkl. Scope, Entscheidungen und Verifikation |
| 5.1.1 Alembic `0018` RBAC Permissions | DONE | Permission-Katalog + Role-Permission-Seeding fuer bestehende Rollen |
| 5.1.2 Alembic `0019` UI Preferences + Dashboard Policies | DONE | Tabellen fuer Theme, Rollen-Policies und User-Dashboard-Konfiguration |
| 5.1.3 Alembic `0020` Product Pricing Domain | DONE | Tabellen fuer Produktbasispreise (netto, USt, Gueltigkeit) |
| 5.1.4 Alembic `0021` Services Catalog Domain | DONE | Tabelle `services` mit Preis-/USt-/Statusfeldern |
| 5.1.5 Alembic `0022` Sales + Invoice Core | DONE | Tabellen fuer Sales Orders, Items, Invoices, Invoice Items, Billing Settings |
| 5.1.6 Alembic `0023` Invoice Export Tracking | DONE | Export-Metadaten fuer XRechnung/ZUGFeRD inkl. Dokumentreferenzen |
| 5.2.1 RBAC Router + Permission APIs | DONE | `/api/roles`, `/api/permissions`, `/api/pages`, Role-Permission-Update |
| 5.2.2 Auth Contract `GET /api/auth/me` Permissions | DONE | `permissions` additiv im AuthUser-Response |
| 5.2.3 Dependency Migration `require_roles` -> `require_permissions` | DONE | Serverseitiger Schutz schrittweise auf Permission-Ebene |
| 5.2.4 Frontend Permission Guards + Dynamic Nav | DONE | Routen- und Sidebar-Sichtbarkeit durch Permissions gesteuert |
| 5.2.5 Users UI fuer Rollen + Rechteverwaltung | DONE | Admin kann Rollen und deren Rechte im UI verwalten |
| 5.3.1 UI Preferences Backend | DONE | `GET/PUT /api/ui-preferences/me` fuer Theme und UI-Flags |
| 5.3.2 Dashboard Policy Backend | DONE | Rollen-/User-Konfiguration fuer erlaubte/Default-Cards |
| 5.3.3 Dashboard Frontend Configurator | DONE | Card-Registry, Add/Remove, Rollen-Templates |
| 5.3.4 Darkmode Frontend | DONE | Toggle, Persistenz, System-Fallback, kontraststabile Tokens |
| 5.4.1 Produktbasispreise API | DONE | CRUD + Preisauflosung netto/brutto inkl. USt-Validierung |
| 5.4.2 Kundenpreise API | DONE | Zeitraumbasierte Preise ohne Ueberlappungen je Kunde/Produkt |
| 5.4.3 Pricing Frontend | DONE | Preis-Tab im Produktformular + Kundenpreis-Verwaltung |
| 5.5.1 Service-Katalog Backend/API | DONE | CRUD fuer Dienstleistungen mit RBAC-Schutz |
| 5.5.2 Service-Katalog Frontend | DONE | UI fuer Serviceanlage und Pflege |
| 5.6.1 Sales Order Backend | DONE | Auftragserstellung mit Produkt-/Servicepositionen |
| 5.6.2 Invoice Backend inkl. Teilrechnung | DONE | Positionsbasiertes Invoicing mit `invoiced_quantity`-Schutz |
| 5.6.3 Lieferschein ueber GoodsIssue | DONE | Delivery Note als Dokumenttyp `delivery_note` |
| 5.6.4 Sales/Invoice Frontend | DONE | Neue Seiten fuer Auftrag, Rechnung, Teilrechnung |
| 5.7.1 XRechnung Export | DONE | XML-Export mit Pflichtfeldvalidierung |
| 5.7.2 ZUGFeRD Export | DONE | PDF/A-3 + eingebettetes Rechnungs-XML als Exportartefakt |
| 5.8.1 Idempotency Prefix-Erweiterung | DONE | Neue Prefixe fuer `/api/sales-orders` und `/api/invoices` |
| 5.8.2 Audit-Entity-Mapping Erweiterung | DONE | Lueckenlose Auditierung fuer neue Domaenen |
| 5.9.1 Guides Doku + In-App Hilfe | DONE | `docs/guides/*` + kontextsensitive Hilfe pro Seite |
| 5.10.1 Backend-Testabdeckung Phase 5 | DONE | Tests fuer RBAC, Pricing, Services, Sales/Invoice, E-Invoice inkl. strict Success/Failure |
| 5.10.2 Frontend Unit/E2E Phase 5 | DONE | Tests fuer Darkmode, Dashboard, Rollen, Pricing, Teilrechnung |
| 5.10.3 Doku-Updates Phase 5 | DONE | Update von `README.md`, `directstock.md`, `docs/validation/*` |
| 5.11.1 Gesamtverifikation + Abnahmebericht | DONE | Nachweis in `docs/validation/phase5-acceptance.md` |

## Offene Punkte aus SOTA-Review 2026-02-14 (adressiert in Planung)
1. Frontend-Rollenlisten waren bisher statisch in Navigation/Guards.
Status: **ADDRESSED IN PLAN** durch dynamisches Permission-RBAC mit Backend-Source-of-Truth.
2. Preislogik war nicht explizit auf netto-fuehrende Konsistenz und USt-Validierung ausgerichtet.
Status: **ADDRESSED IN PLAN** durch Produktbasispreise, Kundenpreise und feste DE-USt-Validierungsregeln.
3. Rechnung/Teilrechnung und Lieferschein-Workflow waren nicht als durchgaengige Domaene beschrieben.
Status: **ADDRESSED IN PLAN** durch Sales-Order/Invoice-Domaene und GoodsIssue-basierte Lieferschein-Erzeugung.
4. Dashboard-Customizing hatte keine serverseitig durchgesetzte Rollenpolicy.
Status: **ADDRESSED IN PLAN** durch `role_dashboard_policies`, Card-Katalog und serverseitige Validierung.
5. E-Rechnungsanforderungen waren noch ohne klaren Export-/Validierungsrahmen.
Status: **ADDRESSED IN PLAN** durch XRechnung-/ZUGFeRD-Export, Pflichtfeldpruefung und Dokumentversionierung.

## Oeffentliche API-/Interface-Aenderungen (additiv)

### Backend HTTP APIs
1. `GET /api/permissions`
2. `GET /api/pages`
3. `GET /api/roles`
4. `POST /api/roles`
5. `PUT /api/roles/{role_id}`
6. `DELETE /api/roles/{role_id}`
7. `PUT /api/roles/{role_id}/permissions`
8. `GET /api/ui-preferences/me`
9. `PUT /api/ui-preferences/me`
10. `GET /api/dashboard/cards/catalog`
11. `GET /api/dashboard/config/me`
12. `PUT /api/dashboard/config/me`
13. `GET /api/dashboard/config/roles/{role_id}`
14. `PUT /api/dashboard/config/roles/{role_id}`
15. `GET /api/pricing/products/{product_id}/base-prices`
16. `POST /api/pricing/products/{product_id}/base-prices`
17. `GET /api/pricing/customers/{customer_id}/product-prices`
18. `PUT /api/pricing/customers/{customer_id}/product-prices/{product_id}`
19. `GET /api/services`
20. `POST /api/services`
21. `PUT /api/services/{service_id}`
22. `DELETE /api/services/{service_id}`
23. `GET /api/sales-orders`
24. `POST /api/sales-orders`
25. `GET /api/sales-orders/{order_id}`
26. `POST /api/sales-orders/{order_id}/items`
27. `POST /api/sales-orders/{order_id}/delivery-note`
28. `GET /api/invoices`
29. `POST /api/invoices`
30. `POST /api/invoices/{invoice_id}/partial`
31. `POST /api/invoices/{invoice_id}/exports/xrechnung`
32. `POST /api/invoices/{invoice_id}/exports/zugferd`

### Header- und Idempotency-Vertraege
1. Neue mutierende Endpunkte in Sales/Invoice unterstuetzen `X-Client-Operation-Id`.
2. Replay-/Konfliktverhalten bleibt kompatibel zu bestehender Middleware.
3. Fehlerformat bleibt unveraendert: `code`, `message`, `request_id`, `details`.

### Frontend-Typen und Routen
1. `RoleName` wird zu `string` generalisiert; dynamische Rollen sind damit ohne Frontend-Deploy nutzbar.
2. Neue Typen: `Permission`, `Role`, `ThemePreference`, `DashboardConfig`, `ProductPrice`, `CustomerProductPrice`, `ServiceItem`, `SalesOrder`, `Invoice`.
3. Neue Seiten: `SalesOrdersPage`, `InvoicesPage`, `ServicesPage`, optional `CustomerPricingPage`.

## Implementierungsdetails pro Workstream

### A) RBAC Next-Gen
1. Permissions als erstklassiger Vertrag in DB und Auth-Response.
2. Backend-Endpunkte pruefen Rechte serverseitig ueber `require_permissions`.
3. Statische Rollenlisten in Frontend-Routing und Navigation entfallen.

### B) UI Preferences, Dashboard, Darkmode
1. Theme-Persistenz pro Benutzer mit Fallback auf System-Theme.
2. Dashboard-Cards aus zentralem Katalog, serverseitig gegen Rollenpolicy validiert.
3. Admin kann Rollen-Templates definieren und Customizing einschranken.

### C) Pricing Engine
1. Produktbasispreis: netto, USt-Satz, Waehrung, Gueltigkeitsfenster.
2. Kundenpreis: priorisiert vor Basispreis, mit Non-Overlap-Regeln.
3. Preisauflosung liefert konsistente netto/brutto Werte fuer UI und Rechnung.

### D) Services Catalog
1. Dienstleistungen als eigene Positionstypen mit Preis/USt.
2. Keine Lagerbewegung fuer Servicepositionen.
3. Einheitlicher CRUD-Fluss mit RBAC und Audit.

### E) Sales + Invoice Workflow
1. Sales Order mischt Produkt- und Servicepositionen.
2. Teilrechnung positionsbasiert; Ueberfakturierung technisch blockiert.
3. Lieferschein entsteht ueber bestehende GoodsIssue-Domaene und wird als Dokument gespeichert.

### F) E-Invoice Readiness
1. XRechnung/XML und ZUGFeRD-Export als versionierte Dokumente.
2. Pflichtfeldvalidierung ueber Billing Settings und Rechnungsdaten.
3. Kein externer Versand in v1, nur exportierbare Artefakte.

### G) Cross-Cutting Hardening
1. Neue Domaenen in Audit- und Idempotency-Middleware aufnehmen.
2. Konfliktverhalten (`409`) und Details-Struktur stabil halten.
3. Performance-Schutz durch Pagination und zielgerichtete Indizes.

### H) Guides & Adoption
1. `docs/guides` pro Kernmodul mit Schrittfolgen und Troubleshooting.
2. In-App Help Trigger in relevanten Seitenkopfbereichen.
3. Einheitliche Test-IDs fuer stabilen E2E-Zugriff.

## Testfaelle und Szenarien

### Backend
1. `test_rbac_permissions_phase5.py`: Rollen-/Permission-CRUD, Guard-Enforcement, dynamische Rollen.
2. `test_ui_preferences_phase5.py`: Theme/Dashboard-Persistenz, Rollenpolicy-Enforcement.
3. `test_pricing_phase5.py`: netto/brutto-Konsistenz, DE-USt-Validierung, Gueltigkeitskonflikte.
4. `test_services_catalog_phase5.py`: Service-CRUD, RBAC, Audit.
5. `test_sales_orders_phase5.py`: Produkt+Servicepositionen, Statuswechsel, Delivery-Note-Flow.
6. `test_invoices_phase5.py`: Teilrechnung, Mengenbegrenzung, Export-Gueltigkeit.
7. `test_offline_idempotency_phase5.py`: Replay/Konflikt fuer Sales/Invoice Mutationen.

### Frontend Unit
1. Permission-Guard Tests fuer Routing und Navigation.
2. Theme-State Tests inkl. Persistenz und System-Fallback.
3. Pricing-UI Tests fuer Netto/Brutto-Anzeige und Kundenpreis-Prioritaet.

### Frontend E2E
1. `rbac-dynamic-role-flow.spec.ts`: Rolle anlegen, Rechte zuweisen, Sichtbarkeit verifizieren.
2. `darkmode-persistence-flow.spec.ts`: Theme umschalten, Reload, Persistenz pruefen.
3. `dashboard-config-flow.spec.ts`: Cards verwalten, Rollenpolicy wirksam.
4. `sales-invoice-partial-flow.spec.ts`: Auftrag, Teillieferung, Teilrechnung, Restmenge.
5. `einvoice-export-flow.spec.ts`: XRechnung/ZUGFeRD Export + Download.

### Migrations- und Betriebsverifikation
1. `alembic upgrade head` auf leerer DB ohne Fehler.
2. Seed-/Bootstrap-Pfad fuer Rollen/Permissions deterministisch.
3. Smoke: `/health`, `/api/health`, `/api/docs`, Login, RBAC-Admin-Flows.

## Verifikations-Checkliste (Phase 5)
1. `cd backend && python -m pytest -q`
2. `cd frontend && npm run test`
3. `cd frontend && npm run build`
4. `cd frontend && npm run test:e2e`
5. `alembic upgrade head` auf frischer DB.
6. API Smoke fuer neue RBAC-, Pricing-, Sales- und Invoice-Endpunkte.
7. Dokumenten-Download Smoke fuer `delivery_note`, `xrechnung`, `zugferd`.

## Risiken und Gegenmassnahmen
1. Permission-Drift zwischen Backend und Frontend: zentrale Permission-Codes + Contract-Tests.
2. Preis-/Steuerfehler: feste Validierungsregeln + Rundungsregeln + Testvektoren.
3. Teilrechnungs-Inkonsistenz: transaktionale Updates von `invoiced_quantity`.
4. Dashboard-Policy-Bypass: serverseitige Policy-Validierung bei jeder Konfig-Mutation.
5. Doku-Adoptionsrisiko: In-App-Hinweise und Aufgabenbezogene Guides verpflichtend.

## Definition of Done (DoD)
1. Alle Tasks 5.0.1-5.11.1 umgesetzt und dokumentiert.
2. Relevante Backend-/Frontend-/E2E-Tests gruen.
3. Keine Breaking Changes an bestehenden API-Vertraegen.
4. Doku aktualisiert:
   `README.md`  
   `directstock.md`  
   `directstock_phase5.md`  
   `docs/validation/phase5-acceptance.md`

## Annahmen und Defaults
1. Sprache: Deutsch.
2. Zeitbezug: UTC.
3. Steuerraum v1: Deutschland (EUR, USt 19/7/0).
4. Preisfuehrung: Netto.
5. Lieferschein-Domaene: `GoodsIssue`-basiert.
6. E-Rechnung v1: Datei-Export ohne Provider-Transport.

## Finale Abnahme - Phase 5

Status: **ACCEPTED (2026-02-14)**

Abschlussnachweis: `docs/validation/phase5-acceptance.md`
