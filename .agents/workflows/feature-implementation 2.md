---
description: End-to-end feature implementation workflow — from branch to PR
---

# Feature Implementation Workflow

// turbo-all

## Prerequisites
- Feature objective is clear (from user prompt or issue)
- Relevant domain entrypoint has been read from `docs/agents/entrypoints/`

## Steps

1. **Discover context** — Read the relevant entrypoint, context pack, and repo-index.json:
   ```bash
   cat docs/agents/entrypoints/<domain>.md
   cat docs/agents/context-packs/<area>.md
   python3 scripts/generate_repo_index.py --check
   ```

2. **Create feature branch**:
   ```bash
   git checkout -b feat/<short-description> main
   ```

3. **Implement backend changes** (if applicable):
   - Schema changes in `backend/app/schemas/`
   - Service logic in `backend/app/services/`
   - Router endpoint in `backend/app/routers/`
   - Alembic migration if DB schema changed:
     ```bash
     cd backend && alembic revision --autogenerate -m "<description>"
     ```

4. **Implement frontend changes** (if applicable):
   - API service in `frontend/src/services/`
   - Types in `frontend/src/types.ts`
   - Page/component in `frontend/src/pages/` or `frontend/src/components/`
   - Keep pages < 350 LOC, extract logic to hooks/services

5. **Run backend tests**:
   ```bash
   cd backend && python -m pytest -q
   ```

6. **Run frontend tests**:
   ```bash
   cd frontend && npm run test
   cd frontend && npm run build
   ```

7. **Check contract drift**:
   ```bash
   ./scripts/check_api_contract_drift.sh
   ```

8. **Check file size limits**:
   ```bash
   ./scripts/check_file_size_limits.sh
   ```

9. **Update entrypoint** if a new module was added:
   ```bash
   python3 scripts/generate_repo_index.py --write
   python3 scripts/check_entrypoint_coverage.py
   ```

10. **Commit and report**:
    ```bash
    git add -A && git commit -m "feat: <description>"
    ```

## Completion Criteria
- All tests pass
- No contract drift
- File sizes within limits
- Entrypoints updated if needed
