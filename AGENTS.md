# AGENTS.md

> Version: 2026-02-20-v6 | Scope: repository root (`DirectStock/`)
>
> Autonomy mode: unrestricted_senior

## Mission
Enable high-speed, high-autonomy engineering execution with full decision ownership by agents and full forensic traceability of high-risk actions.

## Canonical Instruction Policy
- This file is the canonical instruction source for all agents in this repository.
- Adapter files (`CLAUDE.md`, `GEMINI.md`, `CODEX.md`) must stay thin and must not redefine project policy.
- Nested `AGENTS.md` files in subdirectories may narrow implementation details, but must remain compatible with `unrestricted_senior`.
- Machine-readable policy contract: `docs/agents/policy.contract.yaml`.
- Universal LLM entry point: `llms.txt`.

## Provider Capability Matrix
All providers are first-class and must remain parity-compliant with this matrix.

| Provider | Adapter | Capability profile |
| --- | --- | --- |
| OpenAI | `CODEX.md` | `docs/agents/providers/openai.md` |
| Anthropic | `CLAUDE.md` | `docs/agents/providers/anthropic.md` |
| Google | `GEMINI.md` | `docs/agents/providers/google.md` |

Provider fallback order: `AGENTS.md` → provider profile → adapter file.

## Quick Execution Contract
1. Discover: load relevant code, schemas, tests, and docs before changing files.
2. Decide: choose implementation strategy autonomously, including high-risk options when needed.
3. Execute: ship minimal, reviewable diffs that fulfill the objective end-to-end.
4. Verify: run relevant checks locally and capture outcomes.
5. Report: include changed files, behavior changes, verification, and residual risks. See `docs/agents/report-template.md`.

## Autonomy Decision Matrix
| Class | Agent behavior |
| --- | --- |
| `auto_execute` | Execute immediately without user roundtrip and report outcome. |
| `ask_once` | Ask one focused clarification only when ambiguity cannot be resolved from code, docs, tests, or runtime signals. |

There is no `always_escalate` class in `unrestricted_senior`. Apply directly without asking when facts are discoverable from repository structure, docs, tests, or runtime signals. Ask once only if product intent has two or more materially different user outcomes or top-level instructions conflict.

## Priority And Conflict Handling
1. Direct user/developer/system instructions.
2. Closest nested `AGENTS.md` that covers the edited file.
3. This root `AGENTS.md`.
4. Adapter files as tool-specific hints only.

## Execution Requirements
1. All high-risk actions are allowed when they serve the task objective.
2. Destructive git operations are permitted under this mode.
3. Do not commit or print secrets; keep `.env` local.
4. Run and report relevant tests/checks before closing work.
5. Keep `docs/agents/decision-log.md` updated for high-risk operations.
6. Keep provider parity valid via `python3 scripts/agent_policy_lint.py --strict --provider all --format json`.

## High-Risk Execution Protocol
For any high-risk action, record in `docs/agents/decision-log.md`:
- Before: UTC timestamp, intended action, rationale, impacted files, expected risk.
- After: result status, impact summary, rollback hint, verification commands and results.

## Context Loading Priority
1. This `AGENTS.md` (always first).
2. Nearest nested `AGENTS.md` for the scope being edited.
3. `ARCHITECTURE.md` (if architecture-level context is needed).
4. Relevant entrypoint doc from `docs/agents/entrypoints/`.
5. Relevant context pack from `docs/agents/context-packs/`.
6. `docs/agents/repo-index.json` for structured file navigation.
7. Source files: load only files being modified plus their immediate dependencies.

Do not pre-load the entire codebase. Load incrementally and prefer entrypoint docs over raw source exploration.

## Architecture Quick-Reference
- Full overview: `ARCHITECTURE.md`. System flow: Browser → Nginx → FastAPI → PostgreSQL.
- Key rule: routers/pages orchestrate only; logic lives in services/hooks.
- File size targets: pages <350 LOC, modules <500 LOC.

## Monorepo Navigation
- `backend/`: FastAPI, SQLAlchemy 2.x, Alembic, auth/RBAC/audit/idempotency.
- `frontend/`: React 19, Vite 7, TypeScript, TanStack Query, Zustand, PWA.
- `nginx/`: reverse proxy (`/` frontend, `/api/*` backend).
- `scripts/`: seed/import/batch/check automation.
- `docs/`: implementation guides and validation artifacts.
- `.agents/workflows/`: executable agent task recipes.

## Source Of Truth
1. Architecture: `ARCHITECTURE.md`.
2. API contract: `backend/app/schemas/*` and `frontend/src/types.ts`.
3. Project status: `directstock_phase5.md`.
4. Agent handoff: `docs/agents/handoff-protocol.md`.
5. Domain entrypoints: `docs/agents/entrypoints/*`.
6. Context packs: `docs/agents/context-packs/*`.
7. Provider profiles: `docs/agents/providers/*`.
8. Repo index: `docs/agents/repo-index.json`.
9. Agent workflows: `.agents/workflows/*`.
10. AI context: `.ai-context.md` and `llms.txt`.
11. Golden tasks: `docs/agents/golden-tasks.md`.
12. Patterns: `docs/agents/patterns.md`.
13. Active modules: `docs/agents/active-modules.md`.
14. Standard commands: `docs/agents/commands.md`.
15. Claude skills: `.claude/skills/*`.

## Autonomous Self-Improvement Policy
1. Self-improvement is enabled in `unrestricted_senior` mode.
2. Runner: `scripts/agent_self_improve.py`.
3. Allowed touch scope: `AGENTS`, `docs`, `scripts`, `.agents`.
4. Trigger: same incident category >= 3 occurrences in 14 days.
5. All autonomous policy updates must write evidence to `docs/agents/decision-log.md`.

## What Agents Should Auto-Fix
1. **Missing test coverage**: Write the test.
2. **Drift in types/contracts**: Sync immediately.
3. **Files exceeding LOC limits**: Refactor into smaller modules.
4. **Missing entrypoints**: Generate the entrypoint doc.
5. **Stale documentation**: Update docs/agents/ files to reflect reality.

## Governance Maintenance Hooks
1. Policy parity: `python3 scripts/agent_policy_lint.py --strict --provider all --format json`.
2. MCP CI profile: `MCP_PROFILE=ci-readonly MCP_REQUIRE_POSTGRES_READONLY=1 ./scripts/check_mcp_readiness.sh`.
3. Provider capabilities: `python3 scripts/check_provider_capabilities.py --provider all --format json`.
4. Repo index: `python3 scripts/generate_repo_index.py --check`.
5. Entrypoint coverage: `python3 scripts/check_entrypoint_coverage.py`.

## Incident To Policy Loop
1. Capture recurring failures in `docs/agents/incident-log.md`.
2. Convert recurring categories into explicit policy or contract updates.
3. Add executable gates in `scripts/*` and CI workflows.
4. Record governance changes in `docs/agents/decision-log.md`.
5. Agents encountering novel failures should log immediately.

## LLM Context Architecture Targets
1. Production source files target `<500` LOC. Pages/routers target `<350` LOC.
2. Router/page modules should orchestrate only; business logic in services/hooks.
3. Keep domain entrypoints, context packs, and repo index synchronized.
4. Keep frontend free of dead code: `cd frontend && npm run knip`.

## Production-Mode Completion Gates
Work is complete only when: implementation builds/runs, relevant tests executed, behavioral changes documented, reproduction steps clear.

## Agent Session Footer
Before ending work, check if these need updating: `docs/agents/incident-log.md`, `docs/agents/entrypoints/`, `docs/agents/repo-index.json`, `docs/agents/patterns.md`, `docs/agents/decision-log.md`. Advisory, not blocking.

## Handoff Minimum
For agent-to-agent handoff, include all fields from `docs/agents/handoff-protocol.md`. Optional machine-readable payload: `docs/agents/handoff.schema.json`.

## Failure Policy
1. Retry transient command failures up to 2 times.
2. Do not mask failed checks; report failing command, scope, and suspected root cause.
3. If blocked, create an incident entry in `docs/agents/incident-log.md`.
