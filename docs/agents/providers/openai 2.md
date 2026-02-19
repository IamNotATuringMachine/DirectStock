# OpenAI Provider Profile (Codex CLI + Codex App + Responses)

## Scope
- Adapter: `CODEX.md`
- Canonical policy: `AGENTS.md`
- Contract: `docs/agents/policy.contract.yaml`

## Required Capabilities
1. `responses_api`
2. `conversation_state`
3. `background_mode`
4. `mcp_tooling`
5. `multi_agent_workflows`
6. `codex_app_orchestration`
7. `reasoning_effort_tiers`

## Capability To Behavior Mapping
1. `responses_api` -> use Responses-native execution path for tool orchestration.
2. `conversation_state` -> preserve run state and avoid context resets between dependent subtasks.
3. `background_mode` -> use for long-running checks/evals to avoid partial task closure.
4. `mcp_tooling` -> prefer MCP-backed context before external lookups for repo-local truth.
5. `multi_agent_workflows` -> handoff payloads must include objective, scope, verification evidence.
6. `codex_app_orchestration` -> delegate parallel tasks via Codex App command center (macOS).
7. `reasoning_effort_tiers` -> select effort level based on task complexity (medium/high/xhigh).

## Reasoning Effort Guide
| Effort | Use When |
|---|---|
| `medium` | Single-file edits, doc updates, simple fixes |
| `high` | Multi-file features, refactors, test writing |
| `xhigh` | Architecture changes, complex debugging, cross-cutting concerns |

## Deterministic Runtime Rules
1. Prefer Responses-native tool flows for agent tasks.
2. Prefer MCP context before web lookup when repo/runtime truth is local.
3. Keep `AGENTS.md` highest policy source; adapter text is compatibility-only.
4. Emit verification commands and outcomes for each completed task.
5. Emit runtime evidence when falling back from an unavailable capability.
6. Reference `.agents/workflows/` for step-by-step execution patterns.

## Fallback Order
1. `AGENTS.md`
2. `docs/agents/providers/openai.md`
3. `CODEX.md`

## Failure Handling
1. If required capability is unavailable, continue with best local fallback and log risk in task output.
2. If high-risk change is executed, append pre/post evidence to `docs/agents/decision-log.md`.
3. If Codex App is unavailable, run tasks sequentially via CLI.

## Mandatory Verification Artifacts
1. `python3 scripts/check_provider_capabilities.py --provider openai --format json`
2. `python3 scripts/agent_policy_lint.py --strict --provider openai --format json`
