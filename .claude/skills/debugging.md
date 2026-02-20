---
name: Debugging
description: Reproduce, isolate, fix, and harden bugs with regression coverage
---

# Debugging Skill

## When to Use
When investigating runtime failures, flaky tests, incorrect behavior, or regressions.

## Steps

1. **Reproduce first**:
   - Capture exact command, environment, and input that triggers the issue.
   - Use the narrowest failing test or endpoint call possible.

2. **Isolate failing boundary**:
   - Trace path: router/page -> service/hook -> DB/external boundary.
   - Confirm whether failure is data, logic, permissions, or integration.

3. **Add temporary observability if needed**:
   - Add short-lived debug logs/assertions to prove the hypothesis.
   - Remove or convert to durable diagnostics before finalizing.

4. **Implement minimal fix**:
   - Change only the failing path and immediate dependency.
   - Keep architecture rules: routers/pages orchestrate; services/hooks hold logic.

5. **Add regression test**:
   - Backend: `backend/tests/`
   - Frontend: `frontend/tests/` or targeted unit/e2e specs
   - Ensure the test fails before the fix and passes after.

6. **Run verification**:
   ```bash
   cd backend && python -m pytest -q
   cd frontend && npm run test
   ./scripts/check_file_size_limits.sh
   ```

7. **Log recurring incident categories**:
   - If this maps to a repeated failure mode, append an entry to `docs/agents/incident-log.md`.

## Invariants
- Every bug fix should include or update regression coverage.
- Root cause must be explicit in the final report.
- No hidden behavior changes outside the target scope.

## Anti-Patterns
- Do NOT patch symptoms without reproducing root cause.
- Do NOT skip regression tests.
- Do NOT leave temporary debug code behind.
