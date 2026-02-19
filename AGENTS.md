# AGENTS.md

> Version: 2026-02-19-v4 | Scope: repository root (`DirectStock/`)
>
> Autonomy mode: unrestricted_senior

## Mission
Enable high-speed, high-autonomy engineering execution with full decision ownership by agents and full forensic traceability of high-risk actions.

## Canonical Instruction Policy
- This file is the canonical instruction source for all agents in this repository.
- Adapter files (`CLAUDE.md`, `GEMINI.md`, `CODEX.md`) must stay thin and must not redefine project policy.
- Nested `AGENTS.md` files in subdirectories may narrow implementation details, but must remain compatible with `unrestricted_senior`.
- Machine-readable policy contract: `docs/agents/policy.contract.yaml`.
- Policy contract schema: `docs/agents/policy.schema.json`.

## Provider Capability Matrix
All providers are first-class and must remain parity-compliant with this matrix.

| Provider | Adapter | Capability profile | Required capabilities |
| --- | --- | --- | --- |
| OpenAI | `CODEX.md` | `docs/agents/providers/openai.md` | `responses_api`, `conversation_state`, `background_mode`, `mcp_tooling`, `multi_agent_workflows` |
| Anthropic | `CLAUDE.md` | `docs/agents/providers/anthropic.md` | `claude_code_hooks`, `memory_files`, `prompt_caching`, `mcp_connectors` |
| Google | `GEMINI.md` | `docs/agents/providers/google.md` | `adk_workflows`, `agent_engine_patterns`, `a2a_interoperability`, `mcp_tooling` |

Provider fallback order:
1. `AGENTS.md`
2. provider profile under `docs/agents/providers/*`
3. adapter file (`CODEX.md`/`CLAUDE.md`/`GEMINI.md`)

## Quick Execution Contract
1. Discover: load relevant code, schemas, tests, and docs before changing files.
2. Decide: choose implementation strategy autonomously, including high-risk options when needed.
3. Execute: ship minimal, reviewable diffs that fulfill the objective end-to-end.
4. Verify: run relevant checks locally and capture outcomes.
5. Report: include changed files, behavior changes, verification, and residual risks.

## Autonomy Decision Matrix
Agents must classify each action before executing:

| Class | Agent behavior |
| --- | --- |
| `auto_execute` | Execute immediately without user roundtrip and report outcome. |
| `ask_once` | Ask one focused clarification only when ambiguity cannot be resolved from code, docs, tests, or runtime signals. |

Default mapping:
1. `auto_execute`
   - docs/tooling/runtime changes
   - internal and cross-module refactors
   - API/schema/auth/RBAC/idempotency/security-sensitive changes
   - database migrations and migration strategy changes
   - destructive git operations when required to complete requested outcomes
2. `ask_once`
   - ambiguous product intent with multiple materially different outcomes
   - conflicting top-level instructions that cannot be reconciled via local context

There is no `always_escalate` class in `unrestricted_senior`.

## Deterministic No-Question Rules
For `auto_execute`, agents must proceed without clarification when all needed facts are discoverable from code, docs, tests, or runtime signals.

Apply directly without asking when:
1. A path/module/owner can be resolved from repository structure or nearest scoped `AGENTS.md`.
2. A validation command already exists in repo scripts/docs and can be executed as-is.
3. A contract/type drift is mechanistically fixable by synchronizing schema/types/tests.
4. A missing operational default can be resolved by existing policy defaults in this file.

Ask once only if:
1. Product intent has two or more materially different user outcomes.
2. Top-level instructions conflict and cannot be reconciled via local evidence.

## Priority And Conflict Handling
1. Direct user/developer/system instructions.
2. Closest nested `AGENTS.md` that covers the edited file.
3. This root `AGENTS.md`.
4. Adapter files (`CLAUDE.md`, `GEMINI.md`, `CODEX.md`) as tool-specific hints only.

If instructions conflict, apply the highest-priority rule and document assumptions explicitly.

## Execution Requirements
1. All high-risk actions are allowed when they serve the task objective.
2. Destructive git operations are permitted under this mode.
3. API and schema changes may be breaking when needed.
4. Security-sensitive changes may be executed without pre-approval.
5. Do not commit or print secrets; keep `.env` local.
6. Run and report relevant tests/checks before closing work.
7. Keep `docs/agents/decision-log.md` updated for high-risk operations.
8. Keep provider parity valid via `python3 scripts/agent_policy_lint.py --strict --provider all --format json`.
9. Keep provider runtime capability gates valid via `python3 scripts/check_provider_capabilities.py --provider all --format json`.

## High-Risk Execution Protocol
For any high-risk action (destructive git, breaking contract, security-critical change, invasive migration):
1. Before execution, record a short plan in `docs/agents/decision-log.md` with:
   - UTC timestamp
   - intended action
   - rationale
   - impacted files/systems
   - expected risk
2. Execute the action autonomously.
3. After execution, append:
   - result status
   - impact summary
   - rollback hint
   - verification command(s) and result(s)

## Monorepo Navigation
- `backend/`: FastAPI, SQLAlchemy 2.x, Alembic, auth/RBAC/audit/idempotency.
- `frontend/`: React 19, Vite 6, TypeScript, TanStack Query, Zustand, PWA.
- `nginx/`: reverse proxy (`/` frontend, `/api/*` backend).
- `scripts/`: seed/import/batch/check automation.
- `docs/`: implementation guides and validation artifacts.
- `directstock_phase*.md`: project status and phase history.

## Source Of Truth
1. API contract: `backend/app/schemas/*` and `frontend/src/types.ts`.
2. Project status baseline: `directstock_phase5.md`.
3. Tests as executable specification.
4. Agent handoff protocol: `docs/agents/handoff-protocol.md`.
5. Agent incident log process: `docs/agents/incident-log.md`.
6. Domain entrypoints for LLM navigation: `docs/agents/entrypoints/*`.
7. High-risk forensic log: `docs/agents/decision-log.md`.
8. Context packs: `docs/agents/context-packs/*`.
9. Provider capability docs: `docs/agents/providers/*`.
10. Machine-readable repository navigation index: `docs/agents/repo-index.json`.

## Autonomous Self-Improvement Policy
1. Self-improvement is enabled in `unrestricted_senior` mode.
2. Runner: `scripts/agent_self_improve.py`.
3. Allowed touch scope for autonomous policy updates: `AGENTS`, `docs`, `scripts`.
4. Default recurrence trigger: same incident category >= 3 occurrences in 14 days.
5. All autonomous high-risk policy updates must write pre/post evidence to `docs/agents/decision-log.md`.

## Autonomous Governance Maintenance Hooks
1. Validate policy contract parity: `python3 scripts/agent_policy_lint.py --strict --provider all --format json`.
2. Validate MCP CI profile with read-only posture: `MCP_PROFILE=ci-readonly MCP_REQUIRE_POSTGRES_READONLY=1 ./scripts/check_mcp_readiness.sh`.
3. Validate branch protection baseline for autonomous auto-merge: `./scripts/check_branch_protection.sh`.
4. Validate provider runtime capability contracts: `python3 scripts/check_provider_capabilities.py --provider all --format json`.
5. Validate repo index drift: `python3 scripts/generate_repo_index.py --check`.
6. Validate entrypoint coverage drift: `python3 scripts/check_entrypoint_coverage.py`.

## Incident To Policy To Eval Loop
1. Capture recurring failures in `docs/agents/incident-log.md`.
2. Convert recurring categories into explicit policy or contract updates.
3. Add or tighten executable gates in `scripts/*` and CI workflows.
4. Record high-risk governance changes in `docs/agents/decision-log.md`.
5. Keep loop non-noisy: no timestamp-only churn without semantic policy/gate impact.

## Architecture Defaults (Non-Blocking)
### Backend
- Prefer endpoints under `/api/*`; health at `/health` and `/api/health`.
- Prefer mutation audit entries and server-side RBAC.
- Prefer UTC timestamps.

### Frontend
- Prefer backend access through `frontend/src/services/*`.
- Prefer stable `data-testid` coverage for critical flows.
- Prefer single offline queue (`offlineQueue.ts`) and stable PWA UX.

### Security And Data Integrity
- Prefer stable password/JWT behavior, input validation, and `ApiError` shape.
- These are strong defaults; in `unrestricted_senior` they are advisory, not blocking.

## Production-Mode Completion Gates
Work is complete only when all are true:
- Implementation builds/runs for the touched scope.
- Relevant automated tests were executed locally and reported.
- Behavioral/API changes were documented.
- Reproduction steps are clear.

## Handoff Minimum (Required)
For agent-to-agent or wave handoff, include all fields from `docs/agents/handoff-protocol.md`:
1. objective and scope boundaries
2. exact files changed
3. verification commands + results
4. open risks and follow-up actions
5. explicit assumptions and unresolved questions

Optional machine-readable payload format:
- `docs/agents/handoff.schema.json`

## Failure Policy
1. Retry transient command failures up to 2 times.
2. Do not mask failed checks; report failing command, scope, and suspected root cause.
3. If blocked, create an incident entry using `docs/agents/incident-log.md`.
4. If unrelated worktree changes appear unexpectedly, pause and request user direction.

## LLM Context Architecture Targets
1. Production source files target `<500` LOC.
2. Frontend page containers and backend router files target `<350` LOC.
3. Router/page modules should orchestrate only; business logic should live in services/hooks/view-models.
4. Keep domain entrypoint docs current under `docs/agents/entrypoints/*`.
5. Keep context packs current under `docs/agents/context-packs/*`.
6. Keep `docs/agents/repo-index.json` synchronized via `python3 scripts/generate_repo_index.py --write`.
7. Treat `/DirectStock` (Obsidian workspace) as non-production context unless explicitly requested.

## Standard Commands
```bash
# Dev
docker compose up --build
docker compose -f docker-compose.dev.yml up --build

# Backend tests
cd backend && python -m pytest -q

# Frontend tests
cd frontend && npm run test
cd frontend && npm run test:e2e
cd frontend && npm run test:e2e:raw

# Agent governance
./scripts/agent_governance_check.sh
python3 scripts/agent_policy_lint.py --strict --provider all --format json
python3 scripts/check_provider_capabilities.py --provider all --format json

# Production
docker compose -f docker-compose.prod.yml up -d --build
./scripts/lighthouse_pwa.sh
```

## Agent Report Template
1. Files changed
2. Functional change (what and why)
3. Verification and results
4. Residual risks/open points
5. Optional next 1-3 steps

## Active Modules (Phase 5)
### Backend routers
`auth`, `users`, `products`, `warehouses`, `inventory`, `operations`, `dashboard`, `customers`, `suppliers`, `product_settings`, `purchasing`, `inventory_counts`, `reports`, `alerts`, `abc`, `purchase_recommendations`, `picking`, `returns`, `workflows`, `documents`, `audit_log`, `external_api`, `integration_clients`, `shipping`, `inter_warehouse_transfers`, `permissions`, `pages`, `roles`, `ui_preferences`, `dashboard_config`, `pricing`, `sales_orders`, `invoices`

### Frontend pages
`Products`, `ProductForm`, `GoodsReceipt`, `GoodsIssue`, `StockTransfer`, `Inventory`, `InventoryCount`, `Purchasing`, `Reports`, `Alerts`, `Dashboard`, `Scanner`, `Warehouse`, `Picking`, `Returns`, `Approvals`, `Documents`, `AuditTrail`, `Shipping`, `InterWarehouseTransfer`, `Users`, `Customers`, `SalesOrders`, `Invoices`
