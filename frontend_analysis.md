# Frontend Analyse (Playwright)

Datum: 2026-02-14
Repo: /Users/tobiasmorixbauer/Documents/GitHub/DirectStock

## Executive Summary

Gesamturteil: **funktional sehr stark, visuell klar professioneller und nahe SOTA-Reife**.

Bewertung:
- Funktionalitaet: **9.4/10**
- Optik/Professionalitaet (Desktop): **8.8/10**
- Optik/Professionalitaet (Mobile): **8.5/10**
- Usability: **8.6/10**
- SOTA-Reife gesamt: **8.8/10**

Restpunkte gegen absolute SOTA aktuell:
- Einzelne Domain-Statuswerte bleiben bewusst englisch (Backend-Vertragswerte wie `draft`, `cancelled`, `open`).
- Kein akuter Layout-/Alignment-Break mehr; verbleibende Optimierungen sind Feinschliff (Tokenisierung/Design-Tuning).

## Methodik und Umfang

Durchgefuehrte Verifikation mit Playwright:
- `npm run test:e2e` (Desktop + iPhone SE + iPad)
- Ergebnis: **74 passed, 4 skipped, 0 failed**
- Skips sind erwartbar projektbedingt (mobile-only/desktop-only Assertions in `frontend/tests/e2e/ui-mobile-table-readability.spec.ts` und `frontend/tests/e2e/ui-responsive.spec.ts`).

Zusatz-Audit mit Playwright (automatisiert + manuell):
- Alle 23 Hauptseiten in Desktop und Mobile aufgerufen.
- Fuer jede Seite: Screenshot + Layout-Metriken (Overflow, Topbar-Overlap, Console/Page Errors).
- Ergebnis Metriken: **0 horizontale Overflows**, **0 Topbar-Overlaps**, **0 Console/Page Errors** auf Route-Ebene.

Artefakte:
- /Users/tobiasmorixbauer/Documents/GitHub/DirectStock/output/playwright/frontend-audit-2026-02-14/audit-results.json
- /Users/tobiasmorixbauer/Documents/GitHub/DirectStock/output/playwright/frontend-audit-2026-02-14/*

## Re-Validierung nach Umsetzung (Update 2, 2026-02-14)

Zusaetzlich ausgefuehrte Verifikation nach Implementierung:
- `npm run test` -> **30 passed**
- `npm run build` -> **ok**
- `npx playwright test tests/e2e/ui-responsive.spec.ts tests/e2e/ui-mobile-table-readability.spec.ts tests/e2e/darkmode-persistence-flow.spec.ts tests/e2e/offline-sync-flow.spec.ts --project=web-desktop --project=ios-iphone-se --project=ios-ipad` -> **14 passed, 4 skipped**
- `npm run test:e2e` -> **74 passed, 4 skipped, 0 failed**
- Lokaler UI-Check gegen aktuellen Frontend-Code:
  - `E2E_BASE_URL=http://127.0.0.1:4173 npx playwright test tests/e2e/ui-responsive.spec.ts tests/e2e/ui-mobile-table-readability.spec.ts --project=web-desktop --project=ios-iphone-se --project=ios-ipad` -> **8 passed, 4 skipped**
  - `E2E_BASE_URL=http://127.0.0.1:4173 npx playwright test tests/e2e/alerts-flow.spec.ts --project=web-desktop --project=ios-iphone-se --project=ios-ipad` -> **3 passed**
  - `E2E_BASE_URL=http://127.0.0.1:4173 npm run test:e2e` -> **71 passed, 4 skipped, 3 failed** (alle 3 in `inventory-count-flow.spec.ts`, fachlich nicht aus den UI-Aenderungen abgeleitet; Session blieb `in_progress` statt `completed`)

Status der urspruenglichen Findings:
- P0 Tabellenbasis/Mobile Cards: **done**
  - Tabellen in Services, Invoices, Sales Orders, Users, Audit-Trail auf `products-table mobile-cards-table` mit `data-label` vereinheitlicht.
  - `inventory-table` Styling ergaenzt, verbleibende Nutzung auf standardisierte Tabellen reduziert.
- P0 Fehlende Checkbox-/Danger-Styles: **done**
  - `.checkbox`, `.checkbox-grid`, `.btn.danger` in `styles.css` implementiert.
- P1 Mobile Topbar ueberladen: **done**
  - Theme + Queue in Mobile-Drawer verschoben, mobile Topbar auf Kernaktionen reduziert.
  - Zusaetzlicher CSS-Fix: alte `@media (max-width: 900px)`-Regel wird fuer Topbar-Verhalten korrekt ueberschrieben.
  - E2E-Guard erweitert: `ui-responsive.spec.ts` prueft auf Mobile/Tablet jetzt zusaetzlich die Topbar-Hoehe (Regression-Schutz).
- P1 Sprachkonsistenz: **done**
  - Navigation und zentrale Seiten/Labels auf Deutsch vereinheitlicht (u. a. Berichte, Warnungen, Audit-Trail, Versand, Zwischenlager-Transfer, Verkaufsauftraege).
  - Rest-Englisch bei technischen Domain-Statuswerten bleibt absichtlich.
- P2 Login-Vorbelegung: **done**
  - Credentials nicht mehr vorbelegt.
- P2 QA-Coverage responsive Tabellen: **done**
  - `ui-mobile-table-readability.spec.ts` um `users`, `sales-orders`, `invoices`, `services`, `audit-trail` erweitert.

## Re-Validierung nach Umsetzung (Update 3, 2026-02-14)

Zusatz-Implementierungen:
- Sprachkonsistenz in PWA-/Offline-UI nachgezogen:
  - `On/Off` -> `Online/Offline`
  - `Queue` -> `Warteschlange`
  - `Retry/Discard` -> `Erneut senden/Verwerfen`
- Historisch kollidierende Topbar-Regeln im alten CSS-Block entfernt (reduziert kaskadierende Konfliktgefahr).

Zusatz-Verifikation:
- `npm run test` -> **30 passed**
- `npm run build` -> **ok**
- `E2E_BASE_URL=http://127.0.0.1:4173 npx playwright test tests/e2e/ui-responsive.spec.ts tests/e2e/ui-mobile-table-readability.spec.ts tests/e2e/offline-sync-flow.spec.ts tests/e2e/darkmode-persistence-flow.spec.ts --project=web-desktop --project=ios-iphone-se --project=ios-ipad` -> **14 passed, 4 skipped**
- `E2E_BASE_URL=http://127.0.0.1:4173 npx playwright test tests/e2e/ui-workflow-overflow.spec.ts --project=web-desktop --project=ios-iphone-se --project=ios-ipad` -> **3 passed**
- `npm run test:e2e` gegen bestehenden `:8080`-Stack -> **66 passed, 4 skipped, 8 failed**.
  - Ursachen: Stack lief mit aelterem Frontend-Build (alte Texte/Topbar-Verhalten sichtbar) plus bestehender `inventory-count-flow`-Fehler (`in_progress` statt `completed`).
  - Interpretation: fuer verlaessliche UI-Validierung des aktuellen Codes ist `E2E_BASE_URL=http://127.0.0.1:4173` oder ein frisch neugebauter Docker-Stack erforderlich.

Status-Update:
- P1 Sprachkonsistenz: **done** (mit beabsichtigter Ausnahme fuer technische Backend-Statuswerte)
- CSS-Duplikate: **teilweise done** (Topbar-Konflikt entfernt; restliche Legacy-Duplikate als Wartungs-Backlog)

Round-3 SOTA-Finding:
- **Keine neuen kritischen Alignment-/Overflow-Probleme** in den validierten Kernseiten auf Desktop, iPhone SE und iPad gefunden.

## Re-Validierung nach Umsetzung (Update 4, 2026-02-14)

Zusatz-Implementierungen:
- Fehlende, real genutzte CSS-Klassen nach Legacy-Cleanup wiederhergestellt (u. a. `login-card`, `error`, `modal-*`, `workflow-*`, `scan-feedback*`, `offline-sync-*`, `pwa-banner`, `tab-strip`, `split-grid`, `batch-grid`, `bin-*`, `static-item`, `btn-tab-active`).
- Dark-Theme-Tokenblock (`:root[data-theme=\"dark\"]`) inkl. zentraler Farbvariablen und Surface-Token wieder eingefuehrt.
- Offline-Sync-/PWA-Komponenten visuell und semantisch konsistent mit den neuen deutschen Labels.

Zusatz-Verifikation:
- `npm run test` -> **30 passed**
- `npm run build` -> **ok**
- `E2E_BASE_URL=http://127.0.0.1:4173 npx playwright test tests/e2e/ui-responsive.spec.ts tests/e2e/ui-mobile-table-readability.spec.ts tests/e2e/offline-sync-flow.spec.ts tests/e2e/darkmode-persistence-flow.spec.ts tests/e2e/ui-workflow-overflow.spec.ts --project=web-desktop --project=ios-iphone-se --project=ios-ipad` -> **17 passed, 4 skipped**
- `E2E_BASE_URL=http://127.0.0.1:4173 npm run test:e2e` -> **70 passed, 4 skipped, 4 failed**
  - `inventory-count-flow` (3x) weiterhin fachlicher Altpunkt: Session bleibt `in_progress` statt `completed`.
  - `goods-receipt-flow` (desktop) im Vollsuite-Lauf 1x Timeout; isoliert erneut ausgefuehrt: **passed** (spricht fuer Suite-/Datenzustands-Flake statt UI-Regression).

Status-Update:
- P0/P1/P2 aus der initialen Analyse: **done**
- CSS-Duplikate/fehlende Klassen nach Cleanup: **done**
- Round-4 SOTA-Bewertung: **keine offenen kritischen visuellen oder responsiven Mismatches** aus Frontend-Sicht.

## Re-Validierung nach Umsetzung (Update 5, 2026-02-14)

Zusatz-Implementierungen:
- Dark-Theme-Feinschliff: verbleibende hardcodierte Light-Flaechen auf Token-Basis harmonisiert (u. a. Input-/Table-/Sidebar-/Topbar-/KPI-/Mobile-Card-Hintergruende).
- Hover/Active-States in Navigation und Tabellenoberflaechen auf Theme-Token umgestellt.

Zusatz-Verifikation:
- `npm run test` -> **30 passed**
- `npm run build` -> **ok**
- `E2E_BASE_URL=http://127.0.0.1:4173 npx playwright test tests/e2e/ui-responsive.spec.ts tests/e2e/ui-mobile-table-readability.spec.ts tests/e2e/offline-sync-flow.spec.ts tests/e2e/darkmode-persistence-flow.spec.ts --project=web-desktop --project=ios-iphone-se --project=ios-ipad` -> **14 passed, 4 skipped**

Status-Update:
- Keine neuen Layout-, Overflow- oder Topbar-Regressionen nach Dark-Theme-Anpassung.
- Frontend-Analysepunkte zu Style/Alignment sind damit abgeschlossen.

## Re-Validierung nach Umsetzung (Update 6, 2026-02-14)

Neue Round-6-Findings (aus frischem Playwright-Audit):
- **Scanner Mobile:** Lookup-Button ueberlagerte das Eingabefeld (Ursache: fehlendes `display:grid` auf `scan-form` + strukturelle Basisstyles).
- **Reports Mobile:** KPI-Labels/Werte liefen optisch zusammen (Ursache: fehlende Block/Grid-Struktur auf KPI-Card-Elementen).
- **Users Mobile:** Eingabefelder wirkten teilweise „unsichtbar“ bzw. ohne klare Formstruktur (Ursache: fehlende grundlegende Input-/Label-/Form-Layoutregeln).

Umsetzung (direkt implementiert):
- Strukturelle Layout-Basis in `styles.css` wiederhergestellt:
  - `display:grid/flex` fuer zentrale Layout-Klassen (`form-grid`, `scan-form`, `kpi-grid`, `two-col-grid`, `warehouse-grid`, `inline-form`, `workflow-step-list`, `sidebar nav`, `actions-cell`, `pagination`).
  - `label` auf Grid-Layout umgestellt; dadurch konsistente Label-zu-Feld-Struktur.
  - Inputs/Selects/Textareas auf einheitliche Grundform (`width`, `padding`, `min-height`, `border`) gebracht.
  - Buttons mit konsistentem `border` + `inline-flex`-Ausrichtung.
  - KPI-Cards auf blockige Typografie (`span`/`strong`) normalisiert.
  - Mobile-spezifisch: `scan-form`-Button auf 100% Breite, damit kein Overlap mehr entsteht.

Round-6-Verifikation:
- Frischer Seitenaudit (23 Seiten x 3 Viewports) mit neuen Artefakten:
  - `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/output/playwright/frontend-audit-round4-2026-02-14/audit-results.json`
  - Ergebnis: **69 checks, 0 overflow issues, 0 topbar overlaps, 0 console errors**
- Build/Unit:
  - `npm run build` -> **ok**
  - `npm run test` -> **30 passed**
- E2E gegen aktuellen Build (`127.0.0.1:4173`):
  - `npm run test:e2e` -> **71 passed, 4 skipped, 3 failed**
  - Verbleibende 3 Fehlschlaege unveraendert im bekannten fachlichen `inventory-count-flow` (`in_progress` statt `completed`), nicht aus Layout-/SOTA-Styles verursacht.

Status nach Round 6:
- Alle offenen Frontend-SOTA-Layout-/Alignment-Punkte aus der Analyse sind **implementiert und revalidiert**.

## Re-Validierung nach Umsetzung (Update 7, 2026-02-14)

Validierung offener Punkte aus `frontend_analysis.md`:
- SOTA-Style/Alignment: **keine offenen Punkte mehr**.
- Offener Restpunkt war nur noch der bekannte `inventory-count-flow` in E2E.

Analyse des verbleibenden Restpunkts:
- Reproduktion ergab bei `POST /api/inventory-counts/{id}/complete` einen Backend-Fehler:
  - `500 internal_error`, `details.error = "MultipleResultsFound"`.
- Damit war der verbleibende Fehler kein Frontend-Layout-Thema, sondern ein fachlicher Backend-Edge-Case im Inventurabschluss.

Umgesetzter Fix (repo-intern):
- Backend-Robustness im Inventurabschluss verbessert:
  - Datei: `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/backend/app/routers/inventory_counts.py`
  - Abschluss verwendet jetzt bevorzugt `count_item.inventory_id` fuer das Ziel-Inventory.
  - Fallback-Query auf Produkt/Bin ist begrenzt (`order_by + limit(1)`), um `MultipleResultsFound` zu vermeiden.
- E2E-Testdiagnostik verbessert:
  - Datei: `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend/tests/e2e/inventory-count-flow.spec.ts`
  - Klare Fehlerausgabe fuer den Abschluss-Call (Status + Body), damit Root-Cause sofort sichtbar ist.

Verifikation:
- Frontend:
  - `npm run test` -> **30 passed**
  - `npm run build` -> **ok**
- Backend:
  - `PYTHONPATH=. .venv/bin/pytest -q tests/test_inventory_counts.py` -> **3 passed**
- Hinweis:
  - E2E gegen den laufenden Stack auf `127.0.0.1:4173` zeigte den bekannten `inventory-count`-Fehler weiterhin, solange der laufende Backend-Container noch den alten Build nutzt.
  - Fuer End-to-End-Bestaetigung des Fixes ist ein Rebuild/Neustart des Stacks mit aktuellem Code erforderlich.

Status nach Round 7:
- Offene SOTA-UI-Themen: **0**
- Offene funktionale Restthemen aus Sicht dieser Analyse: **0 im Code-Stand**, pending nur Deployment/Rebuild-Verifikation.

## Was bereits stark ist

- Sehr gute funktionale Stabilitaet ueber Kernprozesse (Wareneingang/-ausgang, Picking, Alerts, Reports, Shipping, Inter-Warehouse, Offline-Sync).
- Einheitliche Design-Tokens/Farbsystem vorhanden, visuell konsistente Grundsprache.
- Keine globalen Layout-Brueche (kein Body-Overflow, keine Topbar-Content-Ueberlappung).
- Mobile Drawer/Navigation funktioniert technisch stabil.

## Priorisierte Findings (historisch, initialer Stand)

### P0 - Uneinheitliche Tabellenbasis bricht mobile Professionalitaet

Symptom:
- Mobile Tabellen in mehreren Modulen sind abgeschnitten/zu eng oder schlecht lesbar.
- Desktop Tabellen wirken in diesen Modulen ungestylt (Header wirken zusammengezogen).

Betroffene Implementierung:
- `inventory-table` wird in mehreren Seiten genutzt:
  - `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend/src/pages/ServicesPage.tsx:79`
  - `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend/src/pages/InvoicesPage.tsx:95`
  - `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend/src/pages/InvoicesPage.tsx:160`
  - `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend/src/pages/SalesOrdersPage.tsx:132`
  - `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend/src/pages/SalesOrdersPage.tsx:196`
  - `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend/src/pages/UsersPage.tsx:299`
- In `styles.css` existiert Styling fuer `.products-table`, aber **kein** Styling fuer `.inventory-table`.
  - Referenz: `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend/src/styles.css:1312`

Evidenz (Screenshots):
- `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/output/playwright/frontend-audit-2026-02-14/mobile-vp-invoices.png`
- `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/output/playwright/frontend-audit-2026-02-14/mobile-vp-sales-orders.png`
- `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/output/playwright/frontend-audit-2026-02-14/mobile-vp-services.png`

Empfehlung:
- Einheitliche Table-Komponente/Styles erzwingen.
- `inventory-table` eliminieren oder vollstaendig stylen.
- Fuer Mobile in diesen Modulen `mobile-cards-table` + `data-label` konsequent einsetzen.

### P0 - Fehlende Styles fuer Checkbox- und Danger-Varianten

Symptom:
- Checkboxes wirken klein/unauffaellig (Touch-/A11y-Risiko).
- Destruktive Aktion `Loeschen` ist visuell kaum von normalen Buttons unterscheidbar.

Betroffene Stellen:
- Checkbox-Nutzung:
  - `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend/src/pages/DashboardPage.tsx:85`
  - `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend/src/pages/UsersPage.tsx:264`
  - `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend/src/pages/UsersPage.tsx:272`
  - `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend/src/pages/UsersPage.tsx:457`
- Danger-Button Nutzung:
  - `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend/src/pages/UsersPage.tsx:336`
- In `styles.css` fehlen Selektoren fuer `.checkbox`, `.checkbox-grid`, `.danger`.

Evidenz:
- `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/output/playwright/frontend-audit-2026-02-14/desktop-vp-dashboard.png`
- `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/output/playwright/frontend-audit-2026-02-14/desktop-vp-users.png`

Empfehlung:
- Checkbox-Komponente mit klaren Size-Tokens und Focus-Ring einfuehren.
- Touch-Ziele auf Mobile min. 44x44 sicherstellen.
- `.btn.danger` visuell klar differenzieren (Farbe, Border, Hover, Disabled).

### P1 - Mobile Topbar ueberladen

Symptom:
- Auf Mobile sind Theme, Online-Chip, Queue-Chip und Logout gleichzeitig sichtbar.
- Dadurch entsteht hoher vertikaler Verbrauch und kognitive Last direkt im First View.

Betroffene Stellen:
- `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend/src/components/AppLayout.tsx:244`
- `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend/src/components/pwa/PwaStatus.tsx:54`
- `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend/src/components/offline/OfflineSyncPanel.tsx:139`

Evidenz:
- `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/output/playwright/frontend-audit-2026-02-14/mobile-vp-dashboard.png`

Empfehlung:
- Mobile Topbar auf Kernaktionen reduzieren (Menu, User, Online-Status, Logout).
- Theme/Queue in Overflow-Menue oder Drawer verschieben.

### P1 - Sprachkonsistenz uneinheitlich (Deutsch/Englisch gemischt)

Symptom:
- Navigation und Seitentitel mischen Englisch und Deutsch.

Beispiele:
- `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend/src/components/AppLayout.tsx:24`
- `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend/src/components/AppLayout.tsx:28`
- `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend/src/components/AppLayout.tsx:43`

Empfehlung:
- Einheitliche Produktsprache definieren (de oder en) und zentral ueber i18n-Tokens steuern.

### P2 - Login-Vorbelegung wirkt unprofessionell und sicherheitlich unguenstig

Symptom:
- Login ist mit Default-User und Passwort vorbelegt.

Code:
- `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend/src/LoginPage.tsx:7`
- `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend/src/LoginPage.tsx:8`

Evidenz:
- `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/output/playwright/frontend-audit-2026-02-14/desktop-vp-login.png`
- `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/output/playwright/frontend-audit-2026-02-14/mobile-vp-login.png`

Empfehlung:
- Felder leer starten, nur optional per `E2E_*` in Testkontext befuellen.

### P2 - QA-Coverage fuer responsive Tabellen unvollstaendig

Symptom:
- Mobile-Readability-Tests decken nur eine Teilmenge von Tabellen ab.
- Genau auf nicht abgedeckten Seiten sind sichtbare Mobile-Probleme vorhanden.

Code:
- `/Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend/tests/e2e/ui-mobile-table-readability.spec.ts:10`

Empfehlung:
- Targets erweitern um mindestens: `users`, `sales-orders`, `invoices`, `services`, `audit-trail`.

## Konkreter SOTA-Plan (historisch)

1. Einheitliche Table-Basis bauen (`Table`, `ResponsiveTable`) und alle `inventory-table`-Vorkommen migrieren.
2. Mobile-Kartenlayout als Standard fuer alle tabellarischen Listen <=768px etablieren.
3. Checkbox-/Danger-Komponenten design-system-konform einfuehren.
4. Mobile Topbar vereinfachen (max. 2-3 sichtbare Controls).
5. Sprachkonsistenz ueber zentrales i18n Mapping erzwingen.
6. Login defaults entfernen (nur Test-Harness setzt Credentials).
7. E2E responsive coverage auf alle High-Traffic Tabellen erweitern.
8. Nach Umsetzung erneut Playwright Voll-Audit (Desktop + Mobile + Screenshot-Diff) durchlaufen.

## Fazit

Die urspruenglichen P0/P1-Themen sind funktional umgesetzt und durch Tests validiert. Mit Update 4 sind auch die nach dem CSS-Cleanup offenen Klassen-/Stylingluecken geschlossen. Das Frontend ist damit aus UI-/UX-Sicht auf einem stabilen SOTA-nahen Stand; verbleibende E2E-Fehler liegen derzeit in fachlichen Flows (`inventory-count`) bzw. testzustandsbedingter Flake, nicht in den hier umgesetzten Layout-/Style-Themen.
