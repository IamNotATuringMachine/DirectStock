---
name: Performance
description: Run performance checks, enforce budgets, and prevent regressions
---

# Performance Skill

## When to Use
When a task impacts latency, throughput, rendering cost, query performance, or resource usage.

## Steps

1. **Define performance objective**:
   - Identify target metric (latency, p95, render time, query duration, CPU/memory).
   - Set pass/fail threshold before making changes.

2. **Capture baseline**:
   ```bash
   ./scripts/perf/run_perf_smoke.sh
   ./scripts/perf/assert_budgets.sh
   ```
   - Store relevant output in task notes for before/after comparison.

3. **Apply focused optimization**:
   - Prioritize low-risk, high-impact changes first (indexes, batching, memoization, query shape).
   - Keep behavior and API contracts unchanged unless explicitly required.

4. **Re-run performance checks**:
   ```bash
   ./scripts/perf/run_perf_smoke.sh
   ./scripts/perf/assert_budgets.sh
   ```
   - For deeper sweeps:
   ```bash
   PERF_MODE=full ./scripts/perf/run_perf_smoke.sh
   ./scripts/perf/assert_budgets.sh
   ```

5. **Run correctness gates**:
   ```bash
   cd backend && python -m pytest -q
   cd frontend && npm run test
   ```

6. **Report impact with evidence**:
   - Baseline vs. after values
   - Commands executed
   - Residual risk (for example, data volume sensitivity)

## Invariants
- Performance tuning must not compromise correctness or security controls.
- Budgets must remain automated and repeatable in CI-compatible commands.
- Any schema/index change must include migration and rollback consideration.

## Anti-Patterns
- Do NOT claim improvements without measured baseline and after data.
- Do NOT optimize by weakening validation or permission enforcement.
- Do NOT ship optimizations that only pass in a single local run.
