# Google Provider Profile (Gemini CLI + ADK + A2A)

## Scope
- Adapter: `GEMINI.md`
- Canonical policy: `AGENTS.md`
- Contract: `docs/agents/policy.contract.yaml`

## Required Capabilities
1. `adk_workflows`
2. `agent_engine_patterns`
3. `a2a_interoperability`
4. `mcp_tooling`
5. `gemini_cli_headless`
6. `context_import_directives`

## Capability To Behavior Mapping
1. `adk_workflows` -> model multi-step autonomous work as explicit workflow state transitions.
2. `agent_engine_patterns` -> package repeatable task patterns as deterministic execution contracts.
3. `a2a_interoperability` -> handoffs must be transport-agnostic and schema-disciplined.
4. `mcp_tooling` -> prefer MCP-backed context retrieval for repo/runtime truth.
5. `gemini_cli_headless` -> use `gemini -p "<prompt>" --output-format json --approval-mode yolo` for non-interactive automated/CI workflows.
6. `context_import_directives` -> use `@<path>` references in `GEMINI.md` for modular context loading.

## ADK Workflow Agent Types (v2, Feb 2026)
| Type | Use When |
|---|---|
| Sequential | Ordered subtasks with dependencies |
| Parallel | Independent subtasks that can run concurrently |
| Loop (LoopAgent) | Iterative refinement until quality gate passes — e.g., lint → fix → lint until clean |
| Custom (CustomAgent) | Complex branching logic with conditional paths and state management |

### LoopAgent Pattern
Use for iterative quality convergence:
```
LoopAgent: run tests → if fail → fix → re-test → until pass OR max iterations
```
Max iterations should be set (default: 5) to prevent infinite loops.

### CustomAgent Pattern
Use for conditional workflows:
```
CustomAgent: check file type → if backend → run pytest → if frontend → run vitest + build
```

## Conversation Checkpointing
For long-running tasks (30+ min), use conversation checkpointing:
1. Checkpoint after each major subtask completion
2. Include verification results and changed files in checkpoint context
3. Resume from last checkpoint on failure or context refresh
4. Store checkpoint summaries in task handoff format

## Deterministic Runtime Rules
1. Model all multi-agent handoffs with explicit objective, scope, and verification payloads.
2. Treat A2A compatibility as interface discipline, not permission to bypass repo policy.
3. Prefer MCP-backed data access for local code, DB, and runtime context.
4. Keep adapter behavior parity with OpenAI/Anthropic provider profiles.
5. Emit runtime fallback evidence when ADK/A2A primitives are unavailable.
6. For frontend UI/UX changes, run a mandatory visual diff gate for desktop and mobile before completion.
7. For frontend UI/UX changes, run a mandatory accessibility gate for desktop and mobile before completion.
8. Enforce a fallback sequence when design-tooling providers are unavailable.
9. Reference `.agents/workflows/` for step-by-step execution patterns.
10. Use conversation checkpointing for long-running tasks.
11. For Gemini/ADK docs queries, use `directstock-fetch` against `ai.google.dev` and `google.github.io` as primary provider-doc sources.
12. For framework/library docs, use `directstock-context7` first, then fallback to `directstock-fetch` with official-domain constraints.
13. Documentation answers must include source URLs and a verification timestamp (`verified on <UTC date>`).

## Ralph Runtime Parity
`direct ralph` must stay aligned with Gemini CLI behavior:
1. Non-interactive execution uses `gemini -p "<prompt>" --output-format json --approval-mode yolo`.
2. Resume mode uses `--resume <session-id>` and persists `session_id` in plan metadata.
3. Ralph model catalog includes `gemini-3.1-pro-preview` with the same thinking profile options as 3.0 Pro.
4. Fallback order keeps higher-capability Gemini models before flash fallback.
5. Capability probe runs before loop start; strict mode: `--strict-provider-capabilities`.

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
5. If non-interactive `-p` mode is unavailable, run tasks interactively via CLI.

## Mandatory Verification Artifacts
1. `python3 scripts/check_provider_capabilities.py --provider google --format json`
2. `python3 scripts/agent_policy_lint.py --strict --provider google --format json`
3. `cd frontend && npm run test:e2e:visual -- --project=web-desktop`
4. `cd frontend && npm run test:e2e:visual:mobile`
5. `cd frontend && npm run test:e2e:a11y -- --project=web-desktop`
6. `cd frontend && npm run test:e2e:a11y:mobile`
7. `./scripts/check_design_token_drift.sh`
