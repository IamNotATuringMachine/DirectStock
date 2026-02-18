# Refactor Scope Allowlist (One-PR)

## Ziel
Der Refactor-PR bleibt reviewbar, indem nur geplante Bereiche enthalten sind.

## Erlaubte Bereiche
1. Hygiene/Tooling/CI:
   - `.editorconfig`
   - `.pre-commit-config.yaml`
   - `.github/workflows/ci.yml`
   - `backend/ruff.toml`
   - `frontend/eslint.config.js`
   - `frontend/.prettierrc`
   - `frontend/.prettierignore`
   - `.gitignore`
2. Frontend-Routing + Hotspots:
   - `frontend/src/App.tsx`
   - `frontend/src/components/AppLayout.tsx`
   - `frontend/src/routing/*`
   - `frontend/src/pages/ProductFormPage.tsx`
   - `frontend/src/pages/GoodsReceiptPage.tsx`
   - `frontend/src/pages/product-form/**`
   - `frontend/src/pages/goods-receipt/**`
3. Backend-Router/Services (Wave 1):
   - `backend/app/routers/operations/**`
   - `backend/app/routers/reports/**`
   - `backend/app/services/operations/**`
   - `backend/app/services/reports/**`
   - `backend/app/bootstrap.py`
4. Doku/Validierung:
   - `docs/guides/**`
   - `docs/validation/refactor-sota-upgrades.md`
   - `README.md`
   - `AGENTS.md`

## Nicht erlaubt (ohne expliziten Zusatzgrund)
1. Produktfremde Inhaltspflege (z. B. Obsidian-/Canvas-Dateien, alte Phase-Berichte, Lighthouse-Artefakte).
2. Feature-Änderungen außerhalb ProductForm/GoodsReceipt/Operations/Reports.
3. Schema-/API-Breaking-Changes.

## PR-Regel
Jede Datei außerhalb der Allowlist muss im PR-Text unter **"Out-of-scope Ausnahme"** begründet werden.
