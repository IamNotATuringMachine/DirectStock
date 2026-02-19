---
description: Bug fix workflow — from reproduction to verified fix
---

# Bug Fix Workflow

// turbo-all

## Prerequisites
- Bug description or error trace is available
- Affected module/page is identified

## Steps

1. **Read context** — Load relevant entrypoint and context pack:
   ```bash
   cat docs/agents/entrypoints/<domain>.md
   ```

2. **Reproduce** — Run the failing test or trigger the bug:
   ```bash
   cd backend && python -m pytest -q -k "<test_name>"
   # or
   cd frontend && npm run test -- --grep "<test_name>"
   ```

3. **Root-cause analysis** — Trace the call chain:
   - Check error logs/stack traces
   - Identify the specific file and function
   - Check if this is a known pattern in `docs/agents/incident-log.md`

4. **Implement fix** — Make the minimal change that resolves the issue:
   - Prefer the smallest diff possible
   - Keep LOC limits (pages < 350, modules < 500)

5. **Write regression test** (if none exists):
   - Backend: `backend/tests/`
   - Frontend: `frontend/tests/` or `frontend/src/__tests__/`

6. **Verify fix**:
   ```bash
   cd backend && python -m pytest -q
   cd frontend && npm run test
   ```

7. **Check for side effects**:
   ```bash
   ./scripts/check_api_contract_drift.sh
   ./scripts/check_file_size_limits.sh
   ```

8. **Log incident** if this is a recurring pattern:
   - Add entry to `docs/agents/incident-log.md`
   - Check if threshold triggers self-improvement:
     ```bash
     python3 scripts/agent_self_improve.py --mode check
     ```

9. **Commit**:
   ```bash
   git add -A && git commit -m "fix: <description>"
   ```

## Completion Criteria
- Bug no longer reproduces
- Regression test passes
- No contract drift
- Incident logged if recurring
