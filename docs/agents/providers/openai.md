# OpenAI Provider Profile (Codex + Responses)

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

## Capability To Behavior Mapping
1. `responses_api` -> use Responses-native execution path for tool orchestration.
2. `conversation_state` -> preserve run state and avoid context resets between dependent subtasks.
3. `background_mode` -> use for long-running checks/evals to avoid partial task closure.
4. `mcp_tooling` -> prefer MCP-backed context before external lookups for repo-local truth.
5. `multi_agent_workflows` -> handoff payloads must include objective, scope, verification evidence.

## Deterministic Runtime Rules
1. Prefer Responses-native tool flows for agent tasks.
2. Prefer MCP context before web lookup when repo/runtime truth is local.
3. Keep `AGENTS.md` highest policy source; adapter text is compatibility-only.
4. Emit verification commands and outcomes for each completed task.
5. Emit runtime evidence when falling back from an unavailable capability.

## Fallback Order
1. `AGENTS.md`
2. `docs/agents/providers/openai.md`
3. `CODEX.md`

## Failure Handling
1. If required capability is unavailable, continue with best local fallback and log risk in task output.
2. If high-risk change is executed, append pre/post evidence to `docs/agents/decision-log.md`.

## Mandatory Verification Artifacts
1. `python3 scripts/check_provider_capabilities.py --provider openai --format json`
2. `python3 scripts/agent_policy_lint.py --strict --provider openai --format json`
