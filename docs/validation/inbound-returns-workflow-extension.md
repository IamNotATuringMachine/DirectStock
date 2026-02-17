# Validation: WE + Retouren Workflow-Erweiterung

Stand: 2026-02-17

## Umfang
- Backend erweitert fuer WE-Bestellbezug, Produkt-Tracking-Flag, Ad-hoc-Produktanlage und Serienlabel-PDF.
- Retouren erweitert fuer Quelle, externe Reparatur-Statuskette, Spanien-Dispatch/Receive und Formular-Dokument.
- Reports erweitert um interne/externe Reparaturzaehler.
- Frontend erweitert in ProductForm/ProductDetail, GoodsReceipt, Returns und Reports.

## Durchgefuehrte Verifikation
- Python-Kompilierung der geaenderten Backend-Module:
  - `PYTHONPATH=. ./.venv/bin/python -m py_compile app/routers/operations.py app/routers/returns.py app/routers/reports.py app/utils/qr_generator.py app/schemas/phase3.py app/schemas/product.py app/schemas/operations.py app/schemas/reports.py app/models/catalog.py app/models/inventory.py app/models/phase3.py app/bootstrap.py`
  - Ergebnis: erfolgreich (kein Syntaxfehler).

## Bekannte lokale Test-Blockade
- Lokale `pytest`-Ausfuehrung in dieser Session haengt reproduzierbar im Runner (ohne verwertbares Test-Output) und konnte daher nicht als belastbarer Nachweis abgeschlossen werden.
- Betroffene Aufrufe:
  - `PYTHONPATH=. ./.venv/bin/pytest ...`
  - `./.venv/bin/python -m pytest ...`

## Geplante Nachverifikation (nach Behebung der lokalen Runner-Blockade)
1. `cd backend && python -m pytest -q`
2. `cd frontend && npm run test`
3. `cd frontend && npm run build`
4. `cd frontend && npm run test:e2e`
