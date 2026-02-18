# Validation: WE + Retouren Workflow-Erweiterung

Stand: 2026-02-18

## Umfang
- Backend erweitert fuer WE-Modus-Weiche (`po|free`), `source_type`, PO-Resolve, striktes Soll/Ist bei `from-po`, Quarantaene-Routing in RepairCenter-Bin, Mengenlabel-PDF und Produktvertrag `default_bin_id`.
- Retouren erweitert fuer Quelle, externe Reparatur-Statuskette, Spanien-Dispatch/Receive und Formular-Dokument.
- Reports erweitert um interne/externe Reparaturzaehler.
- Frontend erweitert in ProductForm/ProductDetail, GoodsReceipt, Returns und Reports.

## Durchgefuehrte Verifikation
- Backend-Tests (gezielt, inkl. neuer Regressionen):
  - `cd backend && PYTHONPATH=. .venv/bin/pytest -q tests/test_operations.py tests/test_purchase_orders.py tests/test_inbound_returns_workflow_extensions.py tests/test_products.py tests/test_qr_generator.py tests/test_offline_idempotency.py`
  - Ergebnis: `25 passed`.
- Frontend Unit:
  - `cd frontend && npm run test -- --run`
  - Ergebnis: `13 files, 45 tests passed`.
- Frontend Build/Typecheck:
  - `cd frontend && npm run build`
  - Ergebnis: erfolgreich.
- Frontend E2E (fokussiert):
  - `cd frontend && npm run test:e2e -- tests/e2e/goods-receipt-flow.spec.ts`
  - Ergebnis: `8 passed, 1 failed` (siehe Rest-Risiko).

## Rest-Risiko (E2E)
- Ein verbleibender iPhone-SE-E2E-Fail ist ein Mengenvergleich in einem parallel laufenden Multi-Project-Run:
  - Erwartet wurde exakt `afterInventory.raw`, beobachtet wurde eine hoehere Menge durch parallele Bewegungen auf denselben E2E-Artikel.
  - Der funktionale WE-Flow selbst laeuft in allen Projects durch (Anlage, Position, Complete, Tracking/Labels).

## Nachverifikation (empfohlen)
1. E2E serialisieren oder testdaten-projektweise entkoppeln fuer deterministischen Mengenvergleich.
2. Optional: `cd backend && PYTHONPATH=. .venv/bin/pytest -q` als kompletter Backend-Durchlauf.
