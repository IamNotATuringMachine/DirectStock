# AI Agent Setup (AGENTS-Centric, Production Mode)

This repository uses an AGENTS-centric multi-tool setup:
- Canonical policy: `/AGENTS.md`
- Scoped deltas: `/backend/AGENTS.md`, `/frontend/AGENTS.md`
- Thin adapters: `/CLAUDE.md`, `/GEMINI.md`, `/CODEX.md`
- Provider profiles: `/docs/agents/providers/openai.md`, `/docs/agents/providers/anthropic.md`, `/docs/agents/providers/google.md`
- Machine-readable policy contract: `/docs/agents/policy.contract.yaml`
- Contract schema: `/docs/agents/policy.schema.json`
- Handoff protocol: `/docs/agents/handoff-protocol.md`
- Incident process: `/docs/agents/incident-log.md`

All agents should operate in production mode: relevant tests must be run and reported before task completion.

## Autonomy Mode
This repository runs in `unrestricted_senior` mode.

Implications:
1. Agents execute autonomously, including high-risk or breaking changes when needed.
2. Guardrails are documentary/forensic defaults, not blocking approval gates.
3. High-risk actions must be recorded in `docs/agents/decision-log.md`.

## Provider-Parity Contract (OpenAI + Anthropic + Google)
Run provider parity lint before closing governance-impacting changes:

```bash
python3 scripts/agent_policy_lint.py --strict --provider all --format json
```

Provider-specific checks:
1. `python3 scripts/agent_policy_lint.py --strict --provider openai --format json`
2. `python3 scripts/agent_policy_lint.py --strict --provider anthropic --format json`
3. `python3 scripts/agent_policy_lint.py --strict --provider google --format json`

## 1) Codex
Codex already prioritizes `AGENTS.md`. Optional fallback configuration can be added in `~/.codex/config.toml`:

```toml
project_doc_fallback_filenames = ["CODEX.md"]
project_doc_max_bytes = 65536
```

Guideline: keep `AGENTS.md` as source of truth; use fallback files for compatibility only.

## 2) Gemini CLI
Gemini supports configurable context filenames in `~/.gemini/settings.json`:

```json
{
  "context": {
    "fileName": ["AGENTS.md", "GEMINI.md"]
  }
}
```

Recommended order keeps `AGENTS.md` first.

## 3) Claude Code
Keep repository policy in `AGENTS.md` and use `CLAUDE.md` as a thin adapter.

Suggested workflow:
1. Read `AGENTS.md` and nearest nested `AGENTS.md`.
2. Use `@path` references for targeted context.
3. Keep personal/local memory preferences separate from repository policy.

## Production-Mode Working Convention
For every completed task:
1. Plan briefly and inspect impacted files.
2. Implement minimal, reviewable changes.
3. Run relevant tests locally.
4. Report files changed, behavior changes, and test outcomes.
5. For high-risk changes, log rationale, impact, and rollback hint in `docs/agents/decision-log.md`.

## Autonomous Harness (LLM-First)
Use a deterministic entrypoint for autonomous repo work:

```bash
./scripts/autonomous_task_harness.sh
```

Optional strict modes:
1. Include allowlist enforcement:

```bash
ENFORCE_REFRACTOR_SCOPE=1 ./scripts/autonomous_task_harness.sh
```

2. Include isolated E2E smoke:

```bash
RUN_E2E_SMOKE=1 ./scripts/autonomous_task_harness.sh
```

3. Include scorecard metrics (optional flakiness loop):

```bash
COLLECT_SCORECARD_METRICS=1 ./scripts/autonomous_task_harness.sh
COLLECT_SCORECARD_METRICS=1 COLLECT_FLAKINESS=1 FLAKE_RUNS=20 ./scripts/autonomous_task_harness.sh

# Optional performance/security waves
RUN_PERF_SMOKE=1 ./scripts/autonomous_task_harness.sh
RUN_SECURITY_GATES=1 RUN_GITLEAKS=0 ./scripts/autonomous_task_harness.sh
RUN_OBSERVABILITY_SMOKE=1 ./scripts/autonomous_task_harness.sh
RUN_AGENT_GOVERNANCE=1 ./scripts/autonomous_task_harness.sh
```

## E2E Hermetic Rule
E2E specs must not use:
1. hardcoded base URLs (for example `http://localhost:5173`)
2. absolute user paths (for example `/Users/...`)

Use:
1. Playwright `baseURL` with `page.goto('/...')`
2. relative artifact paths under `frontend/output` or `frontend/test-results`

## Mandatory Verification Matrix
Run this matrix based on change type before marking tasks complete:

1. Frontend UI/Type changes:
   - `cd frontend && npm run lint`
   - `cd frontend && npm run test`
   - `cd frontend && npm run build`
2. Backend router/service changes:
   - `cd backend && .venv/bin/ruff check --config ruff.toml app tests`
   - `cd backend && .venv/bin/ruff format --config ruff.toml --check app tests`
   - `cd backend && .venv/bin/python -m pytest -q`
3. Contract-sensitive backend changes:
   - `./scripts/check_api_contract_drift.sh`
4. Refactor-scope controlled changes:
   - `ENFORCE_REFRACTOR_SCOPE=1 ./scripts/autonomous_task_harness.sh`
   - `SIZE_GUARD_MODE=changed ./scripts/check_file_size_limits.sh`
5. E2E-sensitive frontend workflow changes:
   - `cd frontend && npm run test:e2e:hermetic`
   - `cd frontend && npm run test:e2e:smoke`
6. Governance/Wave baseline updates:
   - `./scripts/collect_complexity_metrics.sh`
   - `RUNS=20 TEST_FLAKE_CMD="cd frontend && npm run test:e2e:smoke" ./scripts/collect_test_flakiness.sh`
   - `CI_RUN_LIMIT=20 ./scripts/collect_ci_duration.sh`
7. Perf-sensitive backend changes:
   - `./scripts/perf/run_perf_smoke.sh`
   - `./scripts/perf/assert_budgets.sh`
8. Security- or mutation-integrity-sensitive changes:
   - `./scripts/install_gitleaks.sh` (once per machine)
   - `./scripts/check_security_gates.sh`
   - `./scripts/check_mutation_integrity.py`
9. Observability-sensitive changes:
   - `./scripts/observability/smoke.sh`
10. LLM golden-task verification:
   - `./scripts/run_golden_tasks.sh`
11. Agent governance debt scan:
   - `./scripts/agent_governance_check.sh`
12. Machine-readable policy parity:
   - `python3 scripts/agent_policy_lint.py --strict --provider all --format json`
13. Autonomous self-improvement dry run:
   - `python3 scripts/agent_self_improve.py --mode dry-run --max-changes 5 --touch AGENTS docs scripts`
14. MCP CI profile + read-only posture:
   - `MCP_PROFILE=ci-readonly MCP_REQUIRE_POSTGRES_READONLY=1 ./scripts/check_mcp_readiness.sh`
15. Branch protection baseline for autonomous auto-merge:
   - `./scripts/check_branch_protection.sh`
   - `BRANCH_PROTECTION_REQUIRE_SUPPORTED=1 ./scripts/check_branch_protection.sh` (strict mode, fail if repo plan does not expose branch-protection API)

## MCP Strategy
For project-specific MCP server setup and balanced security defaults, use:
- `docs/guides/mcp-stack-strategy.md`

Quick bootstrap across Codex, Claude Code, and Gemini CLI:

```bash
./scripts/setup_mcp_multi_cli.sh
```
