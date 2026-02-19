# Google Provider Profile (Gemini + ADK/A2A)

## Scope
- Adapter: `GEMINI.md`
- Canonical policy: `AGENTS.md`
- Contract: `docs/agents/policy.contract.yaml`

## Required Capabilities
1. `adk_workflows`
2. `agent_engine_patterns`
3. `a2a_interoperability`
4. `mcp_tooling`

## Capability To Behavior Mapping
1. `adk_workflows` -> model multi-step autonomous work as explicit workflow state transitions.
2. `agent_engine_patterns` -> package repeatable task patterns as deterministic execution contracts.
3. `a2a_interoperability` -> handoffs must be transport-agnostic and schema-disciplined.
4. `mcp_tooling` -> prefer MCP-backed context retrieval for repo/runtime truth.

## Deterministic Runtime Rules
1. Model all multi-agent handoffs with explicit objective, scope, and verification payloads.
2. Treat A2A compatibility as interface discipline, not permission to bypass repo policy.
3. Prefer MCP-backed data access for local code, DB, and runtime context.
4. Keep adapter behavior parity with OpenAI/Anthropic provider profiles.
5. Emit runtime fallback evidence when ADK/A2A primitives are unavailable.

## Fallback Order
1. `AGENTS.md`
2. `docs/agents/providers/google.md`
3. `GEMINI.md`

## Failure Handling
1. If ADK/A2A primitives are unavailable locally, execute equivalent repo-native scripts and gates.
2. For high-risk operations, enforce pre/post entries in `docs/agents/decision-log.md`.

## Mandatory Verification Artifacts
1. `python3 scripts/check_provider_capabilities.py --provider google --format json`
2. `python3 scripts/agent_policy_lint.py --strict --provider google --format json`
