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

## Deterministic Runtime Rules
1. Model all multi-agent handoffs with explicit objective, scope, and verification payloads.
2. Treat A2A compatibility as interface discipline, not permission to bypass repo policy.
3. Prefer MCP-backed data access for local code, DB, and runtime context.
4. Keep adapter behavior parity with OpenAI/Anthropic provider profiles.

## Fallback Order
1. `AGENTS.md`
2. `docs/agents/providers/google.md`
3. `GEMINI.md`

## Failure Handling
1. If ADK/A2A primitives are unavailable locally, execute equivalent repo-native scripts and gates.
2. For high-risk operations, enforce pre/post entries in `docs/agents/decision-log.md`.
