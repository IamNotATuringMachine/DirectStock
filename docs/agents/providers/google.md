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
6. For frontend UI/UX changes, run a mandatory visual diff gate for desktop and mobile before completion.
7. For frontend UI/UX changes, run a mandatory accessibility gate for desktop and mobile before completion.
8. Enforce a fallback sequence when design-tooling providers are unavailable.

## Fallback Order
1. `AGENTS.md`
2. `docs/agents/providers/google.md`
3. `GEMINI.md`

## Failure Handling
1. If ADK/A2A primitives are unavailable locally, execute equivalent repo-native scripts and gates.
2. For high-risk operations, enforce pre/post entries in `docs/agents/decision-log.md`.
3. UI/UX fallback sequence:
   - `cd frontend && npm run test:e2e:visual -- --project=web-desktop`
   - `cd frontend && npm run test:e2e:visual:mobile`
   - `cd frontend && npm run test:e2e:a11y -- --project=web-desktop`
   - `cd frontend && npm run test:e2e:a11y:mobile`
   - `./scripts/check_design_token_drift.sh`
   - mobile commands must target `--project=ios-iphone-se --project=ios-ipad`
4. If MCP or external design SaaS is unavailable, execute local visual/a11y/token gates and report fallback evidence.

## Mandatory Verification Artifacts
1. `python3 scripts/check_provider_capabilities.py --provider google --format json`
2. `python3 scripts/agent_policy_lint.py --strict --provider google --format json`
3. `cd frontend && npm run test:e2e:visual -- --project=web-desktop`
4. `cd frontend && npm run test:e2e:visual:mobile`
5. `cd frontend && npm run test:e2e:a11y -- --project=web-desktop`
6. `cd frontend && npm run test:e2e:a11y:mobile`
7. `./scripts/check_design_token_drift.sh`
