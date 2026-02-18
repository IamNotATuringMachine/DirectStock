# Refactor SOTA Upgrade Notes (2026-02-18)

## Frontend Tooling
- Added ESLint flat config (`frontend/eslint.config.js`).
- Added Prettier config and checks (`frontend/.prettierrc`, `frontend/.prettierignore`).
- Added scripts:
  - `npm run lint`
  - `npm run format`
  - `npm run format:check`
- Added lint/format dependencies and regenerated `frontend/package-lock.json`.

## Backend Tooling
- Added `backend/ruff.toml`.
- Added `ruff` to backend dev dependencies.

## Repo/CI Hygiene
- Added `.editorconfig` and `.pre-commit-config.yaml`.
- Added GitHub Actions pipeline: `.github/workflows/ci.yml`.
- Updated `.gitignore` for frontend artifacts and `*.tsbuildinfo`.
- Removed tracked artifact: `frontend/tsconfig.tsbuildinfo`.

## Architecture Follow-up
- `ProductFormPage` and `GoodsReceiptPage` are now container-only entry files.
- Main implementation moved to:
  - `frontend/src/pages/product-form/ProductFormWorkspace.tsx`
  - `frontend/src/pages/goods-receipt/GoodsReceiptWorkspace.tsx`
- Operations router common helpers now delegate to operation service modules.
- Reports quantization now delegates to `backend/app/services/reports/aggregation_service.py`.
