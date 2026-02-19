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

## Deterministic Runtime Rules
1. Prefer Responses-native tool flows for agent tasks.
2. Prefer MCP context before web lookup when repo/runtime truth is local.
3. Keep `AGENTS.md` highest policy source; adapter text is compatibility-only.
4. Emit verification commands and outcomes for each completed task.

## Fallback Order
1. `AGENTS.md`
2. `docs/agents/providers/openai.md`
3. `CODEX.md`

## Failure Handling
1. If required capability is unavailable, continue with best local fallback and log risk in task output.
2. If high-risk change is executed, append pre/post evidence to `docs/agents/decision-log.md`.
