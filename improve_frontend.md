# improve_frontend

- `/login` - done
- `/dashboard` - done
- `/products` - done
- `/products/new` - done
- `/products/:id` - done
- `/products/:id/edit` - done
- `/warehouse` - done
- `/inventory` - done
- `/inventory-counts` - done
- `/alerts` - done
- `/reports` - done
- `/purchasing` - done
- `/picking` - offen
- `/returns` - offen
- `/approvals` - offen
- `/documents` - offen
- `/audit-trail` - offen
- `/goods-receipt` - offen
- `/goods-issue` - offen
- `/stock-transfer` - offen
- `/shipping` - offen
- `/inter-warehouse-transfer` - offen
- `/scanner` - offen
- `/users` - offen
- `/services` - offen
- `/sales-orders` - offen
- `/invoices` - offen

## /login QA Runde

### Testmatrix
- Desktop: `web-desktop`
- Mobile fallback fuer iPhone 16: `ios-iphone-15-pro`
- Tablet: `ios-ipad`

### Iterationsprotokoll

| Iteration | Fehlerbild | Fix | Status |
| --- | --- | --- | --- |
| 1 | Keine Fehler in Funktion, UI-Layout oder Responsiveness gefunden. | Kein Code-Fix erforderlich. | done |

### UI/Formatierungs-Probleme
- [x] Keine Ueberlappungen zwischen `login-username`, `login-password` und `login-submit`.
- [x] Konsistente Ausrichtung (linke/rechte Kanten) der Login-Felder und des Submit-Buttons.
- [x] Kein horizontaler Overflow (`html/body scrollWidth <= viewport + 1`) auf Desktop, iPhone-Fallback und iPad.

### Funktionale Probleme
- [x] Invalid Login zeigt Fehlertext `Login fehlgeschlagen` und bleibt auf `/login`.
- [x] Submit per Enter im Passwortfeld funktioniert.
- [x] Valid Login navigiert zu `/dashboard` und rendert `dashboard-page`.
- [x] Keine unerwarteten `pageerror`- oder `console error`-Eintraege im Happy Path.

### Ausgefuehrte Verifikation
- `cd frontend && npx playwright test tests/e2e/login-page-ui.spec.ts --project=web-desktop --project=ios-iphone-15-pro --project=ios-ipad`
- Ergebnis: `9 passed`, `0 failed`

## /dashboard QA Runde

### Testmatrix
- Desktop: `web-desktop`
- Mobile: `ios-iphone-15-pro`
- Tablet: `ios-ipad`

### Iterationsprotokoll

| Iteration | Fehlerbild | Fix | Status |
| --- | --- | --- | --- |
| 1 | Playwright-Setup war nicht isoliert: parallele Projekte schrieben auf dieselbe Dashboard-Konfiguration des Admin-Users; dadurch intermittierende Functional-Fails. | Test auf pro Run neu erzeugte E2E-User mit eigener Dashboard-Konfiguration umgestellt. | done |
| 2 | `dashboard-card-toggle-*` konnte bei schneller Folgeinteraktion inkonsistent reagieren (stale `configItems` waehrend laufender Save-Mutation). | Dashboard-Toggles waehrend `saveConfigMutation.isPending` deaktiviert (`disabled`), E2E-Waits auf stabilen Zustand angepasst. | done |
| 3 | Re-Run nach Fixes auf allen Ziel-Viewports. | Keine weiteren Probleme gefunden. | done |

### UI/Formatierungs-Probleme
- [x] Kein horizontaler Overflow auf `/dashboard` in Desktop, iPhone 15 Pro und iPad Pro 11 (`html/body scrollWidth <= viewport + 1`).
- [x] Alle Dashboard-Container sichtbar und innerhalb des Panels: `Karten konfigurieren`, KPI-Grid, `Kapazitaet`, `Schnellaktionen`, `Letzte Bewegungen`, `Niedrige Bestaende`, `Aktivitaet heute`, `Kritische Warnungen`.
- [x] KPI-Karten (`dashboard-kpi-*`) ohne Ueberlappung und mit gueltigen Bounding-Boxes in allen drei Viewports.
- [x] Responsive Verhalten verifiziert: `.two-col-grid` hat auf Mobile/Tablet 1 Spalte und auf Desktop >= 2 Spalten.
- [x] Screenshot-Review durchgefuehrt: `frontend/output/dashboard-page-web-desktop.png`, `frontend/output/dashboard-page-ios-iphone-15-pro.png`, `frontend/output/dashboard-page-ios-ipad.png`.

### Funktionale Probleme
- [x] Gefunden und behoben: Race-Condition/Inkonsistenz bei schneller Toggle-Bedienung der Kartenkonfiguration.
- [x] Karten-Toggles (`dashboard-card-toggle-*`) sind bedienbar und aktualisieren sichtbare Cards korrekt.
- [x] Schnellaktionen funktionieren: Navigation zu `/goods-receipt`, `/goods-issue`, `/stock-transfer`, `/scanner`.
- [x] Link `dashboard-open-alerts-link` navigiert korrekt nach `/alerts`.
- [x] Keine unerwarteten `pageerror`- oder `console error`-Eintraege im Happy Path.

### Ausgefuehrte Verifikation
- `cd frontend && npx playwright test tests/e2e/dashboard-page-ui.spec.ts --project=web-desktop --project=ios-iphone-15-pro --project=ios-ipad`
- Ergebnis (final): `6 passed`, `0 failed`
- `cd frontend && npm run test -- --run`
- Ergebnis: `9 files passed`, `30 tests passed`
- `cd frontend && npm run build`
- Ergebnis: `success`

## /products QA Runde

### Testmatrix
- Desktop: `web-desktop`
- Mobile: `ios-iphone-15-pro`
- Tablet: `ios-ipad`

### Iterationsprotokoll

| Iteration | Fehlerbild | Fix | Status |
| --- | --- | --- | --- |
| 1 | UI-Test hatte falsche Annahmen (`actions-cell` als `table-cell`) und zu strikte Hoehen-Schwelle fuer mobile Controls. | Assertions in `products-page-ui.spec.ts` korrigiert; Select-Controls mit fixer Hoehe in `styles.css` stabilisiert. | done |
| 2 | Intermittenter `500`-Console-Fehler waehrend Functional-Test (`Failed to load resource`) auf `/api/ui-preferences/me`. | Einmaliges Laden der UI-Preferences in `AppLayout` ueber Access-Token-Gate + Guard eingefuehrt. | partial |
| 3 | Pagination-Assertion war brittle nach Delete (Gesamtseitenzahl kann sich waehrend Re-Query aendern). | Pagination-Assertion auf robuste Seitennummern-RegEx umgestellt. | done |
| 4 | Trotz Frontend-Guard weiterhin intermittenter `500` durch Backend-Race bei `GET /api/ui-preferences/me` (UniqueViolation `uq_user_ui_preferences_user_id`). | Problem auf Backend-Ebene uebernommen. | in progress |
| 5 | Backend-Race in `_get_or_create_preferences` reproduziert (parallel first-access requests). | Backend-Fix: `IntegrityError` bei Insert/Commit abfangen, `rollback` und bestehende Zeile erneut laden; Regressionstest fuer parallele GETs hinzugefuegt; Backend-Container neu gebaut. | done |
| 6 | Abschluss-Validierung nach Backend-Fix. | Mehrfache Re-Runs der `/products`-Playwright-Suite auf Desktop/iPhone/iPad ohne `500`-Console-Fehler. | done |

### UI/Formatierungs-Probleme
- [x] iOS-Select-Controls in der Toolbar hatten zu kleine effektive Hoehe; durch `select.input { height: 44px; }` vereinheitlicht.
- [x] Kein horizontaler Overflow auf `/products` in Desktop, iPhone 15 Pro und iPad Pro 11 (`html/body scrollWidth <= viewport + 1`).
- [x] Table/Card-Darstellung responsiv korrekt: Desktop `table-row`, Mobile `grid`-Cards mit sichtbaren Aktionsbuttons.
- [x] Screenshot-Review durchgefuehrt: `frontend/output/products-page-web-desktop.png`, `frontend/output/products-page-ios-iphone-15-pro.png`, `frontend/output/products-page-ios-ipad.png`.

### Funktionale Probleme
- [x] Interaktive Elemente bedienbar: `products-create-btn`, Suche, Status-/Gruppenfilter, Row-Aktionen (`Details`, `Bearbeiten`, `Loeschen`), Pagination (`Zurueck`, `Weiter`).
- [x] Filterkombinationen verifiziert (Search + Status + Gruppe) inklusive erwarteter Treffer/Nicht-Treffer.
- [x] Delete-Flow verifiziert: geloeschter Artikel erscheint nicht mehr in der Tabelle.
- [x] Behoben: intermittenter `500` auf `/api/ui-preferences/me` durch Backend-Race (`duplicate key value violates unique constraint "uq_user_ui_preferences_user_id"`).

### Ausgefuehrte Verifikation
- `cd frontend && npx playwright test tests/e2e/products-page-ui.spec.ts --project=web-desktop --project=ios-iphone-15-pro --project=ios-ipad`
- Iteration 1: `3 passed`, `3 failed`
- Iteration 2: `5 passed`, `1 failed`
- Iteration 3: `4 passed`, `2 failed`
- Iteration 4: `5 passed`, `1 failed` (intermittenter Backend-500 auf `/api/ui-preferences/me`)
- Iteration 5 (nach Backend-Fix + Container-Rebuild): `6 passed`, `0 failed`
- Iteration 6 (Stabilitaets-Re-Run): `6 passed`, `0 failed`
- `cd backend && PYTHONPATH=. pytest -q tests/test_ui_preferences_phase5.py`
- Ergebnis: `3 passed`
- `cd backend && PYTHONPATH=. pytest -q`
- Ergebnis: `100 passed`

## /products/new QA Runde

### Testmatrix
- Desktop: `web-desktop`
- Mobile: `ios-iphone-15-pro`
- Tablet: `ios-ipad`

### Erfasste interaktive Elemente und UI-Komponenten
- Interaktive Elemente: Link `Zur Liste`, Tabs `Stammdaten|Lagerdaten|Lieferanten`, Inputs `product-form-number|name|description|group|unit|status`, Submit `product-form-submit`.
- UI-Komponenten: `product-form-page` (Panel/Card), `panel-header`, `tab-strip`, `form-grid`, `split-grid`, Info-Subpanel fuer Lagerdaten und Lieferanten im New-Mode.

### Iterationsprotokoll

| Iteration | Fehlerbild | Fix | Status |
| --- | --- | --- | --- |
| 1 | UI-Test-Assertion war auf iPad zu strikt: erwartete 1-spaltiges `split-grid` bei `max-width: 920px`; tatsaechlich kollabiert das Grid erst bei `max-width: 768px`. | Testmetrik auf `isNarrowLayout` (`max-width: 768px`) angepasst; Layout-Validierung fuer iPad bleibt erhalten, aber ohne falsche Fehlalarme. | done |
| 2 | Re-Run nach Anpassung auf allen Ziel-Viewports. | Keine weiteren Fehler in UI, Funktion oder Responsiveness gefunden. | done |

### UI/Formatierungs-Probleme
- [x] Kein horizontaler Overflow auf `/products/new` in Desktop, iPhone 15 Pro und iPad Pro 11 (`html/body scrollWidth <= viewport + 1`).
- [x] Panel, Header, Tab-Strip und Formularfelder sind vollstaendig sichtbar und innerhalb der Panel-Grenzen.
- [x] Keine Ueberlappungen zwischen Tab-Buttons, Header-Aktionen und Formularfeldern (Bounding-Box-Checks in Playwright).
- [x] Responsive Verhalten korrekt: `split-grid` einspaltig auf schmalen Viewports (`<=768px`), zweispaltig auf iPad/Desktop.
- [x] Screenshot-Review durchgefuehrt: `frontend/output/product-form-page-web-desktop.png`, `frontend/output/product-form-page-ios-iphone-15-pro.png`, `frontend/output/product-form-page-ios-ipad.png`.

### Funktionale Probleme
- [x] Alle interaktiven Elemente bedienbar (Link, Tabs, Inputs, Selects, Submit).
- [x] Tabs `Lagerdaten` und `Lieferanten` zeigen im New-Mode korrekt die Hinweise vor dem initialen Speichern.
- [x] Formular-Submit erstellt neuen Artikel erfolgreich und navigiert nach `/products/:id/edit`.
- [x] Nach Redirect sind Stammdaten konsistent (`product-form-number` disabled und Werte korrekt uebernommen).
- [x] Keine unerwarteten `pageerror`- oder `console error`-Eintraege im Happy Path.

### Ausgefuehrte Verifikation
- `cd frontend && npx playwright test tests/e2e/product-form-page-ui.spec.ts --project=web-desktop --project=ios-iphone-15-pro --project=ios-ipad`
- Iteration 1: `5 passed`, `1 failed` (fehlerhafte Testannahme fuer iPad-Layout)
- Iteration 2: `6 passed`, `0 failed`

## /products/:id QA Runde

### Testmatrix
- Desktop: `web-desktop`
- Mobile: `ios-iphone-15-pro`
- Tablet: `ios-ipad`

### Erfasste interaktive Elemente und UI-Komponenten
- Interaktive Elemente: Links `Zur Liste`, `Bearbeiten`.
- UI-Komponenten: `product-detail-page` (Panel/Card), `panel-header`, Summary-`subpanel`, `two-col-grid`, Subpanels `product-detail-inventory` und `product-detail-movements`, `list-item`-Cards fuer Bestand und Bewegungen.

### Iterationsprotokoll

| Iteration | Fehlerbild | Fix | Status |
| --- | --- | --- | --- |
| 1 | UI-Test griff zu frueh auf die Summary-Card zu (`summaryCard = null`), bevor der Produkt-Query abgeschlossen war. | Test-Synchronisation verbessert: Sichtbarkeits-Wait fuer Summary-Card + robuster Direct-Child-Selector statt `:scope`-Abhaengigkeit. | done |
| 2 | Re-Run nach Test-Fix auf allen Ziel-Viewports. | Keine weiteren Fehler in UI, Funktion oder Responsiveness gefunden. | done |

### UI/Formatierungs-Probleme
- [x] Kein horizontaler Overflow auf `/products/:id` in Desktop, iPhone 15 Pro und iPad Pro 11 (`html/body scrollWidth <= viewport + 1`).
- [x] Alle Container sichtbar und korrekt ausgerichtet: Header, Summary-Card, `Bestand je Lagerplatz`, `Letzte 10 Bewegungen`.
- [x] Keine Ueberlappungen zwischen Header-Links (`Zur Liste`, `Bearbeiten`) sowie zwischen den Subpanels (Bounding-Box-Checks).
- [x] Responsive Verhalten verifiziert: `two-col-grid` zweispaltig auf Desktop, einspaltig auf iPhone und iPad gemaess Breakpoint (`max-width: 900px`).
- [x] Screenshot-Review durchgefuehrt: `frontend/output/product-detail-page-web-desktop.png`, `frontend/output/product-detail-page-ios-iphone-15-pro.png`, `frontend/output/product-detail-page-ios-ipad.png`.

### Funktionale Probleme
- [x] Beide Links sind bedienbar: `Bearbeiten` navigiert zu `/products/:id/edit`, `Zur Liste` navigiert zu `/products`.
- [x] Produktdaten werden korrekt angezeigt (Nummer, Name, Beschreibung, Einheit, Status, Gruppe).
- [x] Bestands-/Bewegungsdaten mit Seed-Daten korrekt gerendert (Lagerpfad, Menge, `goods_receipt`).
- [x] Empty-State korrekt: `Kein Bestand vorhanden.` und `Keine Bewegungen.` fuer Produkt ohne Buchungen.
- [x] Keine unerwarteten `pageerror`- oder `console error`-Eintraege im Happy Path.

### Ausgefuehrte Verifikation
- `cd frontend && npx playwright test tests/e2e/product-detail-page-ui.spec.ts --project=web-desktop --project=ios-iphone-15-pro --project=ios-ipad`
- Iteration 1: `3 passed`, `3 failed` (Test-Synchronisation Summary-Card)
- Iteration 2 (final): `6 passed`, `0 failed`

## /products/:id/edit QA Runde

### Testmatrix
- Desktop: `web-desktop`
- Mobile: `ios-iphone-15-pro`
- Tablet: `ios-ipad`

### Erfasste interaktive Elemente und UI-Komponenten
- Interaktive Elemente:
  - Header-Links `Zur Liste`, `Zur Detailseite`.
  - Tab-Buttons `Stammdaten`, `Lagerdaten`, `Lieferanten`.
  - Stammdaten-Form: `product-form-number` (read-only im Edit-Mode), `product-form-name`, `product-form-description`, `product-form-group`, `product-form-unit`, `product-form-status`, `product-form-submit`.
  - Lagerdaten je Standort: Inputs `EAN`, `Lead Time (Tage)`, `Mindestbestand`, `Meldebestand`, `Maximalbestand`, `Sicherheitsbestand`, Aktionen `product-warehouse-save-*`, `product-warehouse-clear-*`.
  - Lieferanten-Tab: `product-supplier-select`, `product-supplier-product-number`, `product-supplier-price`, `product-supplier-lead-time`, `product-supplier-min-order`, `product-supplier-preferred`, `product-supplier-add-btn`, Relation-Aktionen `product-supplier-toggle-preferred-*`, `product-supplier-delete-*`.
- UI-Komponenten:
  - `product-form-page` als Haupt-Panel.
  - `panel-header` mit Action-Buttons.
  - `tab-strip` fuer die 3 Teilbereiche.
  - `form-grid` und `split-grid` fuer Stammdaten/Lieferanten-Layout.
  - `subpanel` fuer Lagerdaten und Lieferanten.
  - `list-stack` + `list-item static-item` fuer Warehouse-Settings und Lieferanten-Relationen.

### Iterationsprotokoll

| Iteration | Fehlerbild | Fix | Status |
| --- | --- | --- | --- |
| 1 | Keine funktionalen Fehler, UI-Glitches, Console-Errors oder Responsive-Probleme auf der Seite festgestellt; alle Assertions gruen. | Kein Frontend-Code-Fix an der Seite erforderlich. | done |
| 2 | QA-Artefakt: Fullpage-Screenshots fuer den Lagerdaten-Tab wurden bei vielen Standorten extrem gross und unpraktisch fuer manuelle Sichtpruefung. | Screenshot-Strategie im neuen Spec auf Viewport-Screenshots umgestellt (`product-form-edit-page-ui.spec.ts`), danach kompletter Re-Run auf allen Ziel-Viewports. | done |

### UI/Formatierungs-Probleme
- [x] Kein horizontaler Overflow auf `/products/:id/edit` in Desktop, iPhone 15 Pro und iPad Pro 11 (`html/body scrollWidth <= viewport + 1`).
- [x] Alle relevanten Container sichtbar und innerhalb des Panels: Header, Tab-Strip, Stammdaten-Form, Lagerdaten-Subpanel, Lieferanten-Subpanel.
- [x] Keine Ueberlappungen zwischen Header-Links, Tab-Buttons und Eingabefeldern (Bounding-Box-Checks in Playwright).
- [x] Responsive Verhalten verifiziert: `split-grid` einspaltig bei `max-width: 768px`, ansonsten zweispaltig (Desktop/iPad).
- [x] Screenshot-Review durchgefuehrt:
  - `frontend/output/product-form-edit-page-master-web-desktop.png`
  - `frontend/output/product-form-edit-page-master-ios-iphone-15-pro.png`
  - `frontend/output/product-form-edit-page-master-ios-ipad.png`
  - `frontend/output/product-form-edit-page-warehouse-web-desktop.png`
  - `frontend/output/product-form-edit-page-warehouse-ios-iphone-15-pro.png`
  - `frontend/output/product-form-edit-page-warehouse-ios-ipad.png`
  - `frontend/output/product-form-edit-page-suppliers-web-desktop.png`
  - `frontend/output/product-form-edit-page-suppliers-ios-iphone-15-pro.png`
  - `frontend/output/product-form-edit-page-suppliers-ios-ipad.png`

### Funktionale Probleme
- [x] Stammdaten bearbeitbar und speicherbar; Redirect nach Save auf `/products/:id` und Ruecknavigation auf `/products/:id/edit` funktional korrekt.
- [x] `product-form-number` bleibt im Edit-Mode korrekt deaktiviert.
- [x] Lagerdaten pro Standort sind voll bedienbar: Speichern persistiert Werte, Loeschen setzt Werte zurueck.
- [x] Lieferanten-Zuordnung funktioniert Ende-zu-Ende: Anlegen, Preferred-Toggle, Entfernen.
- [x] Header-Navigation (`Zur Liste`, `Zur Detailseite`) funktioniert.
- [x] Keine unerwarteten `pageerror`- oder `console error`-Eintraege im Happy Path.

### Ausgefuehrte Verifikation
- `cd frontend && npx playwright test tests/e2e/product-form-edit-page-ui.spec.ts --project=web-desktop`
- Iteration 1: `2 passed`, `0 failed`
- `cd frontend && npx playwright test tests/e2e/product-form-edit-page-ui.spec.ts --project=ios-iphone-15-pro --project=ios-ipad`
- Iteration 1 (Mobile/Tablet): `4 passed`, `0 failed`
- `cd frontend && npx playwright test tests/e2e/product-form-edit-page-ui.spec.ts --project=web-desktop --project=ios-iphone-15-pro --project=ios-ipad`
- Iteration 2 (final): `6 passed`, `0 failed`

## /warehouse QA Runde

### Testmatrix
- Desktop: `web-desktop`
- Mobile: `ios-iphone-15-pro`
- Tablet: `ios-ipad`

### Erfasste interaktive Elemente und UI-Komponenten
- Interaktive Elemente:
  - Warehouse-Form: Inputs `Code`, `Name`, `Adresse`, Submit `Lager anlegen`.
  - Warehouse-Liste: auswählbare `list-item`-Buttons je Lager.
  - Zone-Form: Inputs `Zone-Code`, `Zone-Name`, Select `zone_type`, Submit `Zone anlegen`.
  - Zonen-Liste: auswählbare `list-item`-Buttons je Zone.
  - Batch-Dialog: Inputs `Prefix`, `Aisle To`, `Shelf To`, `Level To`, Submit `Batch anlegen`.
  - QR-Export: Button `warehouse-zone-qr-pdf`.
  - Bin-Karten: pro Bin Button `warehouse-bin-qr-*`.
- UI-Komponenten:
  - Haupt-Panel `Lagerstruktur` mit `panel-header`.
  - `warehouse-grid` mit 3 Top-Level-Subpanels (`Lager`, `Zonen`, `Lagerplaetze`).
  - Dialog-Subpanels `warehouse-batch-create-dialog` und `warehouse-qr-print-dialog`.
  - `warehouse-bin-grid` mit `bin-card`-Eintraegen.

### Iterationsprotokoll

| Iteration | Fehlerbild | Fix | Status |
| --- | --- | --- | --- |
| 1 | Functional-Spec hatte mehrdeutigen Heading-Selector (`Lager` matchte auch `Lagerstruktur`/`Lagerplaetze`). Gleichzeitig UI-Finding auf iPad: `batch-grid` blieb 5-spaltig und war nicht responsive. | Functional-Selector praezisiert (`exact: true`); responsive CSS-Regel fuer `batch-grid` geplant. | partial |
| 2 | Nach erstem Fix weiter instabil: API-Seeding fuer Bin-Batch lief in Konflikte (`409`, zu kurze Prefix-Strategie). iPad zeigte weiterhin 5 Spalten, weil laufender Container noch alte Frontend-CSS auslieferte. | Prefix-Generierung + Retry fuer Batch-Seeding robust gemacht; Frontend-Container neu gebaut, damit CSS-Fix aktiv wird. | partial |
| 3 | Nach Rebuild war UI-Layout auf allen Viewports korrekt, aber Functional-Test hatte noch brittle Placeholder-Selectoren (`Code` matchte auch `Zone-Code`). | Warehouse-Form-Selectoren auf exakte Accessible Names umgestellt (`getByRole(..., exact: true)`). | partial |
| 4 | Re-Run nach allen Fixes. | Keine weiteren UI- oder Funktionsfehler. | done |

### UI/Formatierungs-Probleme
- [x] Gefunden und behoben: `batch-grid` war auf iPad (`<=900px`) 5-spaltig; jetzt responsiv mit 2 Spalten und Full-Width-Action-Button (`frontend/src/styles.css`).
- [x] Kein horizontaler Overflow auf `/warehouse` in Desktop, iPhone 15 Pro und iPad Pro 11 (`html/body scrollWidth <= viewport + 1`).
- [x] Alle Cards/Container sichtbar und innerhalb des Panels (`Lager`, `Zonen`, `Lagerplaetze`, Batch-Dialog, QR-Dialog, Bin-Grid).
- [x] Keine Ueberlappungen zwischen den drei Top-Level-Subpanels (Bounding-Box-Checks in Playwright).
- [x] Responsive Verhalten verifiziert: `warehouse-grid` folgt Breakpoints (`3` Spalten Desktop, `1` Spalte iPhone/iPad).
- [x] Screenshot-Review durchgefuehrt:
  - `frontend/output/warehouse-page-web-desktop.png`
  - `frontend/output/warehouse-page-ios-iphone-15-pro.png`
  - `frontend/output/warehouse-page-ios-ipad.png`

### Funktionale Probleme
- [x] Gefunden und behoben (QA-Automation): brittle Selectoren im neuen Spec (`Lager`-Heading und `Code`/`Name` Placeholder) fuehrten zu Strict-Mode-Fails; auf stabile exakte Selectoren umgestellt.
- [x] Gefunden und behoben: Batch-Seeding fuer UI-Test konnte durch globale Bin-Code-Konflikte (`409`) fehlschlagen; Prefix-Strategie + Retry eingefuehrt.
- [x] Alle interaktiven Elemente bedienbar: Lager anlegen, Lager waehlen, Zone anlegen, Zone waehlen, Batch anlegen, Bin-QR abrufen, Zonen-PDF abrufen.
- [x] Formulare werden korrekt abgeschickt und Daten erscheinen unmittelbar in den Listen/Grids.
- [x] Keine unerwarteten `pageerror`- oder `console error`-Eintraege im Happy Path.

### Ausgefuehrte Verifikation
- `cd frontend && npx playwright test tests/e2e/warehouse-page-ui.spec.ts --project=web-desktop --project=ios-iphone-15-pro --project=ios-ipad`
- Iteration 1: `2 passed`, `4 failed` (3x Selector-Mehrdeutigkeit, 1x iPad-Layout)
- Iteration 2: `4 passed`, `2 failed` (Bin-Prefix-Konflikt, iPad-Layout noch alter Containerstand)
- Iteration 3: `4 passed`, `2 failed` (nur noch Selector-Brittleness `Code/Zone-Code`)
- Iteration 4 (final): `6 passed`, `0 failed`
- `cd frontend && npm run test -- --run`
- Ergebnis: `9 files passed`, `30 tests passed`
- `cd frontend && npm run build`
- Ergebnis: `success`

## /inventory QA Runde

### Testmatrix
- Desktop: `web-desktop`
- Mobile: `ios-iphone-15-pro`
- Tablet: `ios-ipad`

### Erfasste interaktive Elemente und UI-Komponenten
- Interaktive Elemente:
  - Suche: `inventory-search-input`, `inventory-search-btn`.
  - Filter: Select `inventory-warehouse-filter`.
  - Tabellenzeilen (clickable): `inventory-row-*` zum Oeffnen der Detailansicht.
  - Pagination: Buttons `Zurueck`, `Weiter`.
  - Detail-Sheet/Modal: Button `Schliessen`, Klick auf Backdrop zum Schliessen.
- UI-Komponenten:
  - Haupt-Panel `inventory-page` mit `panel-header`.
  - KPI-Bereich (`kpi-grid` mit 4 `kpi-card`-Cards).
  - Toolbar (`products-toolbar`) mit Input/Button/Select.
  - Bestands-Tabelle (`inventory-table`) in `table-wrap` inkl. Mobile-Card-Darstellung.
  - Pagination-Container.
  - `two-col-grid` mit Subpanels `Niedrige Bestaende` und `Letzte Bewegungen`.
  - Modal-Komponenten `modal-backdrop` und `inventory-detail-sheet` (inkl. Bestand pro Lagerplatz + letzte 10 Bewegungen).

### Iterationsprotokoll

| Iteration | Fehlerbild | Fix | Status |
| --- | --- | --- | --- |
| 1 | QA-Automation-Brittleness: Nach Search-Reset wurde erwartet, dass ein spezifischer Datensatz auf Seite 1 sichtbar ist (kann wegen Pagination fehlen). | Assertion angepasst: nach Reset nur stabile Sichtbarkeitspruefung der Tabelle; Datensatzsichtbarkeit erst nach explizitem Warehouse-Filter validiert. | done |
| 2 | QA-Automation-Brittleness (Mobile/Tablet): Selector `getByRole('button', { name: 'Schliessen' })` war mehrdeutig wegen `Navigation schliessen` Overlay-Button. | Selector auf Modal-Scope praezisiert: `detailSheet.getByRole('button', { name: 'Schliessen' })`. | done |
| 3 | QA-Automation-Brittleness: Nach Pagination-Interaktionen wurde Sichtbarkeit zweier spezifischer Produktnummern im aktuellen Viewport erwartet. | Assertion auf robuste Sichtpruefung einer vorhandenen Tabellenzeile umgestellt (`[data-testid^='inventory-row-']`). | done |
| 4 | Abschlusslauf nach allen Spec-Fixes. | Keine weiteren UI-, Funktions- oder Console-Probleme. | done |

### UI/Formatierungs-Probleme
- [x] Kein horizontaler Overflow auf `/inventory` in Desktop, iPhone 15 Pro und iPad Pro 11 (`html/body scrollWidth <= viewport + 1`).
- [x] Alle relevanten Container sichtbar und innerhalb des Panels: Header, KPI-Grid, Toolbar, Tabelle, Pagination, beide Subpanels.
- [x] Keine Ueberlappungen zwischen Toolbar-Controls sowie zwischen den beiden Subpanels (Bounding-Box-Checks in Playwright).
- [x] Responsive Verhalten verifiziert:
  - Tabellenzeile `table-row` auf Desktop/iPad, `grid` (Mobile-Cards) auf iPhone.
  - `two-col-grid` mit 2 Spalten auf Desktop, 1 Spalte auf iPad/iPhone (`<=900px`).
- [x] Modal-Layout geprueft: Backdrop, Card-Grenzen, Header, Close-Button und Content-Grid ohne Ueberlauf.
- [x] Screenshot-Review durchgefuehrt:
  - `frontend/output/inventory-page-web-desktop.png`
  - `frontend/output/inventory-page-ios-iphone-15-pro.png`
  - `frontend/output/inventory-page-ios-ipad.png`
  - `frontend/output/inventory-page-modal-web-desktop.png`
  - `frontend/output/inventory-page-modal-ios-iphone-15-pro.png`
  - `frontend/output/inventory-page-modal-ios-ipad.png`

### Funktionale Probleme
- [x] Alle interaktiven Elemente bedienbar: Suche, Warehouse-Filter, Tabellenzeilen-Klick, Pagination, Modal-Schliessen per Button und Backdrop.
- [x] Suchfunktion arbeitet korrekt (Treffer fuer eindeutige Produktnummer, Ausschluss nicht passender Zeilen).
- [x] Warehouse-Filter arbeitet korrekt (sichtbare Zeilen auf selektiertes Lager eingeschraenkt).
- [x] Detail-Sheet zeigt erwartete Produkt-/Bestands-/Bewegungsdaten fuer selektierte Zeile.
- [x] Gefundene Probleme lagen in der neuen QA-Automation (brittle Assertions/Selectoren) und wurden in der Spec behoben; kein Frontend-Produktionscode-Fix auf `/inventory` erforderlich.
- [x] Keine unerwarteten `pageerror`- oder `console error`-Eintraege im Happy Path.

### Ausgefuehrte Verifikation
- `cd frontend && npx playwright test tests/e2e/inventory-page-ui.spec.ts --project=web-desktop --project=ios-iphone-15-pro --project=ios-ipad`
- Iteration 1: `0 passed`, `3 failed` (zu strikte Sichtbarkeitsannahme nach Search-Reset)
- Iteration 2: `1 passed`, `2 failed` (mehrdeutiger `Schliessen`-Selector auf Mobile/Tablet)
- Iteration 3: `1 passed`, `2 failed` (brittle Sichtbarkeitsannahme nach Pagination)
- Iteration 4 (final): `3 passed`, `0 failed`
- Finaler Re-Run nach Seed-Retry-Robustheitsfix: `3 passed`, `0 failed`

## /inventory-counts QA Runde

### Testmatrix
- Desktop: `web-desktop`
- Mobile: `ios-iphone-15-pro`
- Tablet: `ios-ipad`

### Erfasste interaktive Elemente und UI-Komponenten
- Interaktive Elemente:
  - Session-Form: `inventory-count-type-select`, `inventory-count-warehouse-select`, `inventory-count-tolerance-input`, `inventory-count-notes-input`, `inventory-count-create-btn`.
  - Session-Liste: `inventory-count-session-*` (selectable list-item buttons).
  - Session-Aktionen: `inventory-count-generate-btn`, `inventory-count-regenerate-btn`, `inventory-count-complete-btn`.
  - Scan-/Quick-Capture: `inventory-count-scan-bin-input`, `inventory-count-scan-product-input`, `inventory-count-quick-quantity-input`, `inventory-count-quick-save-btn`.
  - Positionszeilen: `inventory-count-item-qty-*`, `inventory-count-item-save-*`.
- UI-Komponenten:
  - Haupt-Panel `inventory-count-page` mit `panel-header`.
  - `warehouse-grid` mit Subpanels `1. Session anlegen` und `2. Zaehlliste und Abschluss`.
  - KPI-Block (`kpi-grid compact`) fuer Positionen/Gezahlt/Nachzaehlung.
  - Subpanel `3. Scan-/Schnellerfassung` inkl. `workflow-block`.
  - Subpanel `4. Zaehlpositionen` mit `table-wrap` + `inventory-count-items-table`.

### Iterationsprotokoll

| Iteration | Fehlerbild | Fix | Status |
| --- | --- | --- | --- |
| 1 | UI-Glitch: lange Session-Listen liefen ueber den sichtbaren Container und ueberlappten Folge-Subpanels. Zudem mehrere brittle UI-Assertions im neu angelegten Spec. | `list-stack.small` auf vertikales Clipping/Scrollen umgestellt (`overflow-y: auto; overflow-x: hidden;`). Spec fuer Table-Scroll und Completion-Waits robuster gemacht. | partial |
| 2 | Funktionaler Defekt: `POST /api/inventory-counts/{id}/complete` schlug reproduzierbar mit `500` fehl (`MultipleResultsFound` in Alert-Dedupe). | Backend-Fix in `backend/app/services/alerts.py`: Duplicate-Checks mit `limit(1)` abgesichert; Regressionstest fuer doppelte offene Alert-Events hinzugefuegt. | done |
| 3 | Funktionaler Defekt: nach `Neu generieren` konnten Quick-/Row-Saves mit stale Item-IDs `404` erzeugen. | Frontend-Fix in `InventoryCountPage`: Count-Aktionen waehrend Generate/Item-Refetch deaktiviert (`countActionsDisabled`). | done |
| 4 | Abschlusslauf auf allen Ziel-Viewports inkl. Screenshot-Review und Console/Page-Error-Pruefung. | Keine weiteren UI-, Funktions- oder Responsive-Fehler. | done |

### UI/Formatierungs-Probleme
- [x] Gefunden und behoben: Session-Liste ohne Clipping verursachte Ueberlagerung in Mobile/Tablet; `.list-stack.small` hat jetzt eigenes vertikales Scrolling.
- [x] Kein horizontaler Overflow auf `/inventory-counts` in Desktop, iPhone 15 Pro und iPad Pro 11 (`html/body scrollWidth <= viewport + 1`).
- [x] Alle Cards/Container sichtbar und innerhalb des Panels: Header, Session-Form, Session-Liste, Session-Aktionen, KPI-Block, Scan-Block, Items-Tabelle.
- [x] Keine Ueberlappungen zwischen Form-/Action-Controls (Bounding-Box-Checks fuer Create-Felder, Session-Aktionsbuttons, Scan-Controls, Quick-Capture-Aktionen).
- [x] Responsive Verhalten verifiziert: `warehouse-grid` gemaess Breakpoints (`3` Spalten Desktop >1360, `1` Spalte iPad/iPhone <=900).
- [x] Screenshot-Review durchgefuehrt:
  - `frontend/output/inventory-count-page-web-desktop.png`
  - `frontend/output/inventory-count-page-ios-iphone-15-pro.png`
  - `frontend/output/inventory-count-page-ios-ipad.png`

### Funktionale Probleme
- [x] Session-Form ist bedienbar und submitfaehig: Session wird erstellt und als aktive Session angezeigt.
- [x] Session-Aktionen funktionieren: `Zaehlliste generieren`, `Neu generieren` und `Session abschliessen` sind end-to-end geprueft.
- [x] Quick-Capture und Row-Aktionen sind bedienbar; stale Schreibvorgaenge nach Regenerate wurden durch Disable-Guard beseitigt.
- [x] Gefunden und behoben: Completion-Flow verursachte `500` durch Alert-Dedupe-Query (`MultipleResultsFound`); jetzt stabiler Abschluss-Flow mit `200`.
- [x] Keine unerwarteten `pageerror`- oder `console error`-Eintraege im finalen Happy Path auf allen drei Viewports.

### Ausgefuehrte Verifikation
- `cd backend && PYTHONPATH=. .venv/bin/python -m pytest -q tests/test_alerts.py::test_alert_dedupe_handles_duplicate_open_rows_without_error tests/test_inventory_counts.py::test_inventory_count_session_complete_adjusts_inventory`
- Ergebnis: `2 passed`
- `cd frontend && npx playwright test tests/e2e/inventory-count-page-ui.spec.ts --project=web-desktop --project=ios-iphone-15-pro --project=ios-ipad`
- Finale Iteration: `3 passed`, `0 failed`

## /alerts QA Runde

### Testmatrix
- Desktop: `web-desktop`
- Mobile: `ios-iphone-15-pro`
- Tablet: `ios-ipad`

### Erfasste interaktive Elemente und UI-Komponenten
- Interaktive Elemente:
  - Filter-Controls: `alerts-status-filter`, `alerts-severity-filter`, `alerts-type-filter`.
  - Tabellen-Aktion pro Warnung: `alerts-ack-*` (Button `Quittieren`).
  - Pagination: `alerts-page-prev`, `alerts-page-next`, `alerts-page-indicator`.
- UI-Komponenten:
  - Haupt-Panel `alerts-page` mit `panel-header`.
  - KPI-Bereich mit `alerts-kpi-open-count` und `alerts-kpi-active-rules`.
  - Filter-Toolbar (`products-toolbar`).
  - Warnungs-Tabelle `alerts-table` in `table-wrap` (Desktop-Table + Mobile-Card-Layout).
  - Pagination/Action-Bar (`actions-cell`).

### Iterationsprotokoll

| Iteration | Fehlerbild | Fix | Status |
| --- | --- | --- | --- |
| 1 | Neu angelegter Spec war brittle: KPI-Wert konnte im Loading-Zustand `-` sein und brach Parsing/Assertions. | KPI-Read im Spec robust gemacht (Loading-Guard auf numerischen Ready-State). | done |
| 2 | Spec verglich gegen globale API-Counts und war bei parallelen Projekt-Workern instabil (Drift). | Assertion auf robuste Before/After-Session-Logik umgestellt, inklusive eigener Differenzsicherung zwischen `open` und `acknowledged`. | done |
| 3 | Funktionaler Defekt reproduziert: KPI `Offene Warnungen` aenderte sich beim Wechsel des Status-Filters (`open` -> `acknowledged`). | Frontend-Fix in `AlertsPage`: separater Query `alerts-open-count` mit festem `status: "open"`; Mutation invalidiert jetzt auch diesen Query-Key. | done |
| 4 | Nach Code-Fix weiterhin rote Tests, weil Docker-Frontend noch alten Build auslieferte. | Frontend-Container neu gebaut (`docker compose up -d --build frontend nginx`). | done |
| 5 | Restfehler nur im Spec: mobile Assertion erwartete faelschlich `paginationDirection = column`, tatsaechlich `row` via `.actions-cell`. | Assertion korrigiert. | done |
| 6 | Abschlusslauf nach allen Fixes. | Alle Ziel-Viewports gruen. | done |

### UI/Formatierungs-Probleme
- [x] Kein horizontaler Overflow auf `/alerts` in Desktop, iPhone 15 Pro und iPad Pro 11 (`html/body scrollWidth <= viewport + 1`).
- [x] Alle Container sichtbar und korrekt innerhalb des Panels: Header, KPI-Cards, Filter-Toolbar, Tabelle, Pagination.
- [x] Keine Ueberlappung der KPI-Cards und keine Ueberlagerung der Toolbar-/Pagination-Elemente (Bounding-Box-Checks in Playwright).
- [x] Responsive Verhalten verifiziert:
  - iPhone 15 Pro: Tabellenzeilen im Mobile-Card-Modus (`display: grid`).
  - iPad/Desktop: Tabellenzeilen im klassischen Tabellenlayout (`display: table-row`).
  - Toolbar-Grid: 1 Spalte auf Mobile, >=2 Spalten auf iPad/Desktop.
- [x] Screenshot-Review durchgefuehrt:
  - `frontend/output/alerts-page-web-desktop.png`
  - `frontend/output/alerts-page-ios-iphone-15-pro.png`
  - `frontend/output/alerts-page-ios-ipad.png`

### Funktionale Probleme
- [x] Gefunden und behoben: KPI `Offene Warnungen` war statusfilter-abhaengig, obwohl die Kennzahl offene Warnungen zeigen muss.
- [x] Alle interaktiven Elemente bedienbar: Filter-Selects, Quittieren-Button, Pagination-Buttons.
- [x] Quittieren-Flow verifiziert: Open-Alert kann quittiert werden, erscheint unter `acknowledged`, Action-Button ist danach disabled.
- [x] Status-/Severity-/Type-Filter reagieren korrekt und aktualisieren die Tabelle erwartungsgemaess.
- [x] Keine unerwarteten `pageerror`- oder `console error`-Eintraege im finalen Happy Path.

### Ausgefuehrte Verifikation
- `cd frontend && npx playwright test tests/e2e/alerts-page-ui.spec.ts --project=web-desktop --project=ios-iphone-15-pro --project=ios-ipad`
- Iteration 1: `0 passed`, `3 failed` (KPI-Loading-`-` im Spec)
- Iteration 2: `0 passed`, `3 failed` (paralleler Count-Drift durch globale Vergleichsannahme)
- Iteration 3: `0 passed`, `3 failed` (reproduzierter KPI-Produktfehler)
- Iteration 4: `0 passed`, `3 failed` (alter Docker-Frontend-Build)
- Iteration 5: `2 passed`, `1 failed` (mobile Spec-Assertion)
- Iteration 6 (final): `3 passed`, `0 failed`

## /reports QA Runde

### Testmatrix
- Desktop: `web-desktop`
- Mobile: `ios-iphone-15-pro`
- Tablet: `ios-ipad`

### Erfasste interaktive Elemente und UI-Komponenten
- Interaktive Elemente:
  - Report-Typ Select: `reports-type-select` (`stock`, `movements`, `inbound-outbound`, `inventory-accuracy`, `abc`, `returns`, `picking-performance`, `purchase-recommendations`, `trends`, `demand-forecast`).
  - Datumsfilter: `reports-date-from`, `reports-date-to`.
  - Such-/Spezialfilter:
    - `reports-search-input` (Bestand/ABC)
    - `reports-movement-type-select` (Bewegungen)
    - `reports-trend-product-id`, `reports-trend-warehouse-id` (Trends)
    - `reports-forecast-run-id`, `reports-forecast-product-id`, `reports-forecast-warehouse-id` (Bedarfsprognose)
  - Aktionen: `reports-forecast-recompute-btn`, `reports-download-csv-btn`.
  - Pagination (kontextabhaengig): Buttons `Zurueck`, `Weiter` im Footer `.pagination`.
- UI-Komponenten:
  - Haupt-Panel `reports-page` mit `panel-header`.
  - KPI-Grid mit 9 KPI-Cards (`reports-kpi-*`).
  - Filter-Toolbar (`.products-toolbar`).
  - Report-Tabellen:
    - `reports-stock-table`
    - `reports-movements-table`
    - `reports-inbound-outbound-table`
    - `reports-accuracy-table`
    - `reports-abc-table`
    - `reports-returns-table`
    - `reports-picking-performance-table`
    - `reports-purchase-recommendations-table`
    - `reports-trends-sparkline-table`
    - `reports-trends-table`
    - `reports-demand-forecast-table`
  - `table-wrap`-Container und `pagination`-Footer fuer paginierte Reports.

### Iterationsprotokoll

| Iteration | Fehlerbild | Fix | Status |
| --- | --- | --- | --- |
| 1 | Reproduzierbarer UI-Fehler auf iPhone 15 Pro: Reports-Toolbar blieb 2-spaltig, obwohl Mobile 1-spaltig sein soll; zusaetzlich zwei QA-Spec-Brittleness-Punkte (zu strikte `tableRowDisplay`-Annahme bei leerem tbody). | CSS-Override fuer mobile Reports-Toolbar vorbereitet; Spec robuster gemacht (`tableRowDisplay` nur bei vorhandener Datenzeile validieren). | partial |
| 2 | iPhone-Fail blieb bestehen, weil `localhost:8080` noch alten Frontend-Build auslieferte. | Frontend/NGINX Container neu gebaut (`docker compose up -d --build frontend nginx`). | partial |
| 3 | Re-Run nach Rebuild und CSS-Fix auf allen Ziel-Viewports. | Keine weiteren UI-/Funktions-/Console-Probleme. | done |

### UI/Formatierungs-Probleme
- [x] Gefunden und behoben: Reports-Toolbar war auf iPhone 15 Pro zweispaltig (Spezifitaetskonflikt zwischen `[data-testid="reports-page"] .products-toolbar` und Mobile-Breakpoint-Regel); mobile Override mit identischer Spezifitaet hinzugefuegt (`frontend/src/styles.css`).
- [x] Kein horizontaler Overflow auf `/reports` in Desktop, iPhone 15 Pro und iPad Pro 11 (`html/body scrollWidth <= viewport + 1`).
- [x] KPI-Grid, Toolbar und aktive Tabellen sind vollstaendig sichtbar und innerhalb des Panels.
- [x] Keine Ueberlappungen zwischen Toolbar-Controls und KPI-Cards (Bounding-Box-Checks in Playwright).
- [x] Responsive Verhalten verifiziert:
  - iPhone 15 Pro: Reports-Toolbar jetzt 1-spaltig.
  - iPad/Desktop: Reports-Toolbar mehrspaltig (>=2 Spalten) ohne Ueberlagerungen.
- [x] Screenshot-Review durchgefuehrt:
  - `frontend/output/reports-page-web-desktop.png`
  - `frontend/output/reports-page-ios-iphone-15-pro.png`
  - `frontend/output/reports-page-ios-ipad.png`
  - `frontend/output/reports-page-demand-forecast-web-desktop.png`
  - `frontend/output/reports-page-demand-forecast-ios-iphone-15-pro.png`
  - `frontend/output/reports-page-demand-forecast-ios-ipad.png`

### Funktionale Probleme
- [x] Alle interaktiven Elemente sind bedienbar und reagieren erwartungsgemaess (Report-Typen, Datumsfilter, Such-/Spezialfilter, Forecast-Recompute, CSV-Export, Pagination-Buttons falls sichtbar).
- [x] Alle Report-Typen rendern ihre jeweilige Tabelle/Ansicht korrekt nach Umschalten.
- [x] Trends-/Forecast-Filterfluesse funktionieren mit seeded Produkt-/Lagerdaten inkl. sichtbarer Tabellenzeilen.
- [x] Keine unerwarteten `pageerror`- oder `console error`-Eintraege im finalen Happy Path.

### Ausgefuehrte Verifikation
- `cd frontend && npx playwright test tests/e2e/reports-page-ui.spec.ts --project=web-desktop --project=ios-iphone-15-pro --project=ios-ipad`
- Iteration 1: `3 passed`, `3 failed` (1x echter Mobile-Layoutfehler, 2x QA-Spec-Brittleness)
- Iteration 2: `5 passed`, `1 failed` (alter ausgelieferter Frontend-Build)
- Iteration 3 (final): `6 passed`, `0 failed`
- `docker compose up -d --build frontend nginx`
- Ergebnis: Rebuild erfolgreich, finaler Re-Run gruen

## /purchasing QA Runde

### Testmatrix
- Desktop: `web-desktop`
- Mobile: `ios-iphone-15-pro`
- Tablet: `ios-ipad`

### Erfasste interaktive Elemente und UI-Komponenten
- Interaktive Elemente:
  - Tab-Buttons: `purchasing-tab-orders`, `purchasing-tab-abc`, `purchasing-tab-recommendations`.
  - Bestellformular: `purchase-order-supplier-select`, `purchase-order-notes-input`, `purchase-order-create-btn`.
  - Bestellliste: `purchase-order-item-*` (selectable list-item buttons).
  - Positionsformular: `purchase-order-item-product-select`, `purchase-order-item-quantity-input`, `purchase-order-item-price-input`, `purchase-order-item-add-btn`.
  - Statusworkflow-Buttons: `purchase-order-status-approved`, `purchase-order-status-ordered`, `purchase-order-status-partially_received`, `purchase-order-status-completed`, `purchase-order-status-cancelled` (kontextabhaengig gemaess aktueller Bestellung).
  - ABC-Tab: `abc-recompute-btn`.
  - Recommendations-Tab: `purchase-recommendations-generate-btn`, row actions `purchase-recommendation-convert-*`, `purchase-recommendation-dismiss-*`.
- UI-Komponenten:
  - Haupt-Panel `purchasing-page` mit `panel-header`.
  - Tab-Action-Row (`actions-cell`).
  - `warehouse-grid` mit 3 Subpanels: `1. Bestellung anlegen`, `2. Positionen`, `3. Statusworkflow`.
  - Form-Container (`form-grid`) fuer Order- und Item-Eingaben.
  - Listencontainer `purchase-order-list` und `purchase-order-items-list`.
  - `purchasing-abc-tab` mit `abc-table` in `table-wrap`.
  - `purchasing-recommendations-tab` mit `purchase-recommendations-table` in `table-wrap`.

### Iterationsprotokoll

| Iteration | Fehlerbild | Fix | Status |
| --- | --- | --- | --- |
| 1 | Neuer `/purchasing`-Spec lief technisch gruen (`6 passed`), aber Screenshot-Review zeigte klaren UI-Glitch: Bestell-Listeneintraege renderten ohne sauberen Textfluss (`PO...Status...` klebte zusammen). | CSS-Fix in `frontend/src/styles.css`: `list-item` als echte Kartenzeile mit Grid-Flow, Block-Rendering fuer `strong/span`, zusaetzlich konsistente Hover-/Active-Darstellung fuer selektierbare `button.list-item`. | partial |
| 2 | Nach CSS-Aenderung schlugen Functional-Assertions zur neuen Darstellung fehl (`strong display=inline`), weil `localhost:8080` noch alten Frontend-Build auslieferte. | Container-Rebuild (`docker compose up -d --build frontend nginx`) und erneuter Playwright-Lauf. | done |
| 3 | Re-Run nach Rebuild. | Keine weiteren UI-, Funktions- oder Responsive-Probleme. | done |

### UI/Formatierungs-Probleme
- [x] Gefunden und behoben: Bestell-Listeneintraege hatten unsauberes Inline-Layout ohne visuelle Trennung zwischen Ordernummer und Status.
- [x] Gefunden und behoben: fehlende konsistente Active/Hover-Rueckmeldung auf selektierbaren `list-item`-Buttons.
- [x] Kein horizontaler Overflow auf `/purchasing` in Desktop, iPhone 15 Pro und iPad Pro 11 (`html/body scrollWidth <= viewport + 1`).
- [x] Alle Cards/Container sichtbar und innerhalb des Panels: Header, Tabs, 3 Orders-Subpanels, ABC-Table, Recommendations-Table.
- [x] Keine Ueberlappung zwischen Tabs/Subpanels/Tabellencontainern (Bounding-Box-Checks in Playwright).
- [x] Responsive Verhalten verifiziert:
  - `warehouse-grid` folgt Breakpoints (`3` Spalten Desktop >1360, `1` Spalte iPad/iPhone <=900).
  - Tabellen im Mobile-Viewport (<=768) im `mobile-cards-table`-Modus (`tbody tr` = `display: grid`), sonst `table-row`.
- [x] Screenshot-Review durchgefuehrt:
  - `frontend/output/purchasing-page-web-desktop.png`
  - `frontend/output/purchasing-page-ios-iphone-15-pro.png`
  - `frontend/output/purchasing-page-ios-ipad.png`
  - `frontend/output/purchasing-page-abc-web-desktop.png`
  - `frontend/output/purchasing-page-abc-ios-iphone-15-pro.png`
  - `frontend/output/purchasing-page-abc-ios-ipad.png`
  - `frontend/output/purchasing-page-recommendations-web-desktop.png`
  - `frontend/output/purchasing-page-recommendations-ios-iphone-15-pro.png`
  - `frontend/output/purchasing-page-recommendations-ios-ipad.png`

### Funktionale Probleme
- [x] Alle interaktiven Elemente bedienbar: Tab-Wechsel, Order/Create-Form, Item-Form, Statusworkflow, ABC-Recompute, Recommendations-Generate, Convert und Dismiss.
- [x] Formulare werden korrekt abgeschickt:
  - Bestellung wird erstellt und als aktive Bestellung angezeigt (`draft`).
  - Position wird hinzugefuegt und in der Positionsliste gerendert.
  - Statusworkflow (`approved` -> `ordered`) funktioniert.
- [x] ABC-Recompute erzeugt/aktualisiert Zeilen in `abc-table`.
- [x] Recommendations-Flow funktioniert Ende-zu-Ende:
  - `Bestellvorschlaege erzeugen` erstellt offene Empfehlungen.
  - Convert-Aktion setzt Recommendation-Status auf `converted` (API-verifiziert).
  - Dismiss-Aktion setzt Recommendation-Status auf `dismissed` (API-verifiziert).
- [x] Keine unerwarteten `pageerror`- oder `console error`-Eintraege im finalen Happy Path.

### Ausgefuehrte Verifikation
- `cd frontend && npx playwright test tests/e2e/purchasing-page-ui.spec.ts --project=web-desktop --project=ios-iphone-15-pro --project=ios-ipad`
- Iteration 1: `6 passed`, `0 failed` (visueller Screenshot-Fund trotz gruener Assertions)
- Iteration 2: `3 passed`, `3 failed` (nur wegen altem ausgelieferten Frontend-Build)
- `docker compose up -d --build frontend nginx`
- Ergebnis: Rebuild erfolgreich
- Iteration 3 (final): `6 passed`, `0 failed`
