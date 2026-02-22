# Change Playbooks (Agentic)

## 1) Docs/Policy Change
1. Update `AGENTS.md` and relevant `docs/agents/*` files.
2. Run:
   - `./scripts/check_refactor_scope_allowlist.sh`
   - `./scripts/check_file_size_limits.sh`
   - `./scripts/agent_governance_check.sh`
   - `python3 scripts/agent_policy_lint.py --strict --provider all --format json`
3. Report policy deltas and residual risk.

## 2) Frontend Domain Change
1. Keep pages orchestration-only; move logic to hooks/services/components.
2. Keep API access in `frontend/src/services/*`.
3. Run:
   - `cd frontend && npm run lint`
   - `cd frontend && npm run test`
   - `cd frontend && npm run build`

## 3) Backend Domain Change
1. Keep routers orchestration-only; move logic to services.
2. Preserve RBAC/audit/idempotency contracts.
3. Run:
   - `./scripts/run_backend_pytest.sh -q`
   - `./scripts/check_api_contract_drift.sh`

## 4) Cross-Cutting Change
1. Split into additive slices (tooling, contract, implementation, docs).
2. Run `./scripts/autonomous_task_harness.sh` where feasible.
3. Update validation docs if behavior/gates changed.

## 5) Incident Recovery
1. Capture incident in `docs/agents/incident-log.md` template.
2. Add policy/gate update to prevent recurrence.
3. Re-run failing gate and document closure evidence.
