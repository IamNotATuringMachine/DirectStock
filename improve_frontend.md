# Improve Frontend: Playwright-gestuetzte UI-Verbesserung (Web + iOS)

## 1. Kontext und Ziel

Datum der Umsetzung: **2026-02-14**  
Primaerer Bewertungsstand: **Workspace-Frontend auf `http://127.0.0.1:4173`**  
Docker-Hinweis: Der Stack auf `http://localhost:8080` wurde nur als Referenz betrachtet, nicht als Source of Truth fuer die finalen UI-Befunde.

Ziel war eine schlichte, moderne und robuste UI mit Fokus auf:
- iOS-/Web-Responsiveness ohne globales horizontales Overflow
- konsistente Topbar- und Mobile-Density
- bessere mobile Lesbarkeit zentraler Tabellen
- Playwright-basierte Nachweisfuehrung fuer Abnahme

## 2. Methodik

### 2.1 Qualitaetskriterien
1. Kein globales horizontales Overflow (`html/body scrollWidth <= viewport + 1`).
2. Keine Topbar-Content-Ueberlappung.
3. Mobile Navigation als Drawer bleibt funktional.
4. Mobile Tabellen sind ohne Zoom lesbar.
5. Bestehende API-/Type-Vertraege bleiben unveraendert.

### 2.2 Playwright-Pruefumfang
- Responsive Baseline: `frontend/tests/e2e/ui-responsive.spec.ts`
- Neuer Overflow-Guard: `frontend/tests/e2e/ui-workflow-overflow.spec.ts`
- Neuer Mobile-Table-Readability-Guard: `frontend/tests/e2e/ui-mobile-table-readability.spec.ts`
- Visual + Metrics Audit Artefakte: `output/playwright_audit/audit-report.json` und Screenshots in `output/playwright_audit/`

## 3. Ausgangsbefund (vor finalem Fix)

Reproduzierter Restfehler auf iOS (Workspace-Stand vor finalem CSS-Fix):
- Seiten: `/goods-receipt`, `/goods-issue`, `/stock-transfer`
- Messung: `viewportWidth` 320/393, aber `htmlScrollWidth = 461`
- Root Cause: native `select`-Controls in `form-grid` erzwingen auf iOS eine zu grosse intrinsische Breite in den Workflow-Fallback-Formularen.

## 4. Umgesetzte Verbesserungen

## 4.1 P0: iOS-Overflow-Fix fuer Workflow-Seiten
Datei: `frontend/src/styles.css`

Umsetzung:
- Breiten-/Shrink-Regeln fuer Form/Grid-Kontext verstaerkt:
  - `main.content`, `.form-grid`, `.form-grid > *`, `.form-grid label` mit `min-width: 0`.
  - `.form-grid .input`, `select.input`, `.btn`, `textarea` mit `min-width: 0`, `max-width: 100%`, `box-sizing: border-box`.
- iOS-sichere Select-Kuerzung in Formularen:
  - `overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap`, zusaetzlicher rechter Innenabstand.
- Mobile Width-Zwang in `@media (max-width: 768px)` fuer Formularcontrols (`width: 100%`).

Ergebnis:
- Die drei betroffenen Workflow-Seiten laufen auf iPhone SE und iPhone 15 Pro ohne globalen Overflow.

## 4.2 Topbar- und Mobile-Density-Politur
Dateien:
- `frontend/src/components/AppLayout.tsx`
- `frontend/src/components/pwa/PwaStatus.tsx`
- `frontend/src/components/offline/OfflineSyncPanel.tsx`
- `frontend/src/styles.css`

Umsetzung:
- Topbar user label als gekuerzter Name (`.topbar-user-name`) gegen Umbruch/Spill.
- Compact Online-Indicator auf Mobile (`On`/`Off`) mit `aria-label` fuer Semantik.
- Compact Queue-Chip Text (`Queue N`) plus `aria-label` mit Online/Offline-Status.
- Mobile Topbar Layout gestrafft:
  - `flex-wrap: nowrap`, reduzierte Gaps, stabilere Breitenverteilung links/rechts.
  - Touch Targets in der Topbar auf mindestens `44px` Mindesthoehe.

Ergebnis:
- Kompaktere, weniger fragmentierte Mobile-Topbar mit stabiler Bedienbarkeit.

## 4.3 Mobile Tabellen-Readability (gezielte Kernseiten)
Dateien:
- `frontend/src/pages/ProductsPage.tsx`
- `frontend/src/pages/InventoryPage.tsx`
- `frontend/src/pages/AlertsPage.tsx`
- `frontend/src/pages/PurchasingPage.tsx`
- `frontend/src/pages/ShippingPage.tsx`
- `frontend/src/styles.css`

Umsetzung:
- Betroffene Tabellen additiv mit Klasse `mobile-cards-table` versehen.
- Relevante `td`-Zellen mit `data-label` angereichert.
- Mobile Card-Rendering unter `@media (max-width: 768px)`:
  - Tabellenkopf visuell versteckt.
  - `td::before { content: attr(data-label) }` fuer Feldlabel.
  - Reihen als Karten, Aktionen untereinander/wrap-faehig.
- Komplexe nicht-cardified Tabellen behalten Scroll-Verhalten und bekommen mobile Scroll-Cue (visueller Hint).

Ergebnis:
- Kern-Tabellen sind mobil lesbarer und ohne horizontales Gesamtseiten-Overflow nutzbar.

## 4.4 QA-Absicherung per neuen E2E-Specs
Neue Dateien:
- `frontend/tests/e2e/ui-workflow-overflow.spec.ts`
- `frontend/tests/e2e/ui-mobile-table-readability.spec.ts`

Inhalt:
- Expliziter Overflow-Guard fuer `/goods-receipt`, `/goods-issue`, `/stock-transfer`.
- Mobile-Readability-Guard fuer cardified Tabellen inkl. `data-label`/`::before` Nachweis.
- Desktop-Guard bestaetigt erhaltene Header-Zeile ohne mobile Pseudo-Labels.

## 5. Finale Playwright-Audit-Ergebnisse

Quelle: `output/playwright_audit/audit-report.json`

Finale Summary (nach Umsetzung):
- `web-desktop`: `pages=8`, `overflow=0`, `overlap=0`
- `ios-iphone-se`: `pages=8`, `overflow=0`, `overlap=0`
- `ios-iphone-15-pro`: `pages=8`, `overflow=0`, `overlap=0`

Exemplarische Screenshots:
- `output/playwright_audit/web-desktop-dashboard.png`
- `output/playwright_audit/ios-iphone-se-dashboard.png`
- `output/playwright_audit/ios-iphone-se-goods-issue.png`
- `output/playwright_audit/ios-iphone-15-pro-products.png`

## 6. Testprotokoll (ausgefuehrt)

## 6.1 Unit Tests
Befehl:
```bash
cd /Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend
npm run test
```
Ergebnis:
- PASS
- `5` Test Files, `19` Tests bestanden

## 6.2 Build
Befehl:
```bash
cd /Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend
npm run build
```
Ergebnis:
- PASS
- `tsc --noEmit` + Vite Build erfolgreich

## 6.3 Responsive Spec (bestehend)
Befehl:
```bash
cd /Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend
E2E_BASE_URL=http://127.0.0.1:4173 npm run test:e2e:responsive -- --project=web-desktop --project=ios-iphone-se --project=ios-iphone-15-pro --project=ios-ipad
```
Ergebnis:
- PASS
- `7 passed`, `1 skipped`

## 6.4 Neuer Workflow-Overflow Spec
Befehl:
```bash
cd /Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend
E2E_BASE_URL=http://127.0.0.1:4173 npx playwright test tests/e2e/ui-workflow-overflow.spec.ts --project=ios-iphone-se --project=ios-iphone-15-pro
```
Ergebnis:
- PASS
- `2 passed`

## 6.5 Neuer Mobile-Table-Readability Spec
Befehl:
```bash
cd /Users/tobiasmorixbauer/Documents/GitHub/DirectStock/frontend
E2E_BASE_URL=http://127.0.0.1:4173 npx playwright test tests/e2e/ui-mobile-table-readability.spec.ts --project=ios-iphone-se --project=ios-iphone-15-pro --project=web-desktop
```
Ergebnis:
- PASS
- `3 passed`, `3 skipped`
- (Skips sind projektbedingt und intentional: mobile-only vs. desktop-only Assertions)

## 7. Geaenderte Dateien

- `frontend/src/components/AppLayout.tsx`
- `frontend/src/components/pwa/PwaStatus.tsx`
- `frontend/src/components/offline/OfflineSyncPanel.tsx`
- `frontend/src/pages/ProductsPage.tsx`
- `frontend/src/pages/InventoryPage.tsx`
- `frontend/src/pages/AlertsPage.tsx`
- `frontend/src/pages/PurchasingPage.tsx`
- `frontend/src/pages/ShippingPage.tsx`
- `frontend/src/styles.css`
- `frontend/tests/e2e/ui-workflow-overflow.spec.ts` (neu)
- `frontend/tests/e2e/ui-mobile-table-readability.spec.ts` (neu)
- `improve_frontend.md` (neu geschrieben)

## 8. Rest-Risiken und offene Punkte

1. `styles.css` ist historisch gewachsen; weitere modulare Aufteilung (z. B. layout/components/pages) reduziert mittelfristig Wartungsrisiken.
2. Fuer sehr datendichte Tabellen (insb. Reports) sind zusaetzliche visuelle Snapshot-Tests pro Device sinnvoll.
3. Mobile Card-Layout ist gezielt fuer Kernseiten aktiv; fuer weitere Tabellen kann das Muster additiv ausgerollt werden.

## 9. Fazit

Die geplanten UI-Massnahmen wurden umgesetzt und verifiziert.  
Der iOS-Overflow auf den drei kritischen Workflow-Seiten ist beseitigt, mobile Tabellen sind lesbarer, und die QA ist ueber neue Playwright-Specs dauerhaft abgesichert.
