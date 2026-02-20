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
8. `skills_system`
9. `open_responses_spec`
10. `context_compaction`

## Capability To Behavior Mapping
1. `responses_api` -> use Responses-native execution path for tool orchestration.
2. `conversation_state` -> preserve run state and avoid context resets between dependent subtasks.
3. `background_mode` -> use for long-running checks/evals to avoid partial task closure.
4. `mcp_tooling` -> prefer MCP-backed context before external lookups for repo-local truth.
5. `multi_agent_workflows` -> handoff payloads must include objective, scope, verification evidence.
6. `codex_app_orchestration` -> delegate parallel tasks via Codex App command center (macOS).
7. `reasoning_effort_tiers` -> select effort level based on task complexity (medium/high/xhigh).
8. `skills_system` -> use `$skill-name` syntax for invoking reusable task recipes in Codex CLI.
9. `open_responses_spec` -> structured output via Open Responses Spec for interoperable agent results.
10. `context_compaction` -> provider-native context window management with structured summaries.

## Reasoning Effort Guide
| Effort | Use When |
|---|---|
| `medium` | Single-file edits, doc updates, simple fixes |
| `high` | Multi-file features, refactors, test writing |
| `xhigh` | Architecture changes, complex debugging, cross-cutting concerns |

## Skills System (Feb 2026)
Codex CLI supports a skills system for reusable task automation:
- Invoke skills with `$skill-name` syntax in prompts
- Skills are defined as Markdown recipes (similar to `.claude/skills/`)
- Cross-compatible with SKILL.md convergence standard (Linux Foundation)

## Open Responses Spec (Feb 2026)
Standardized agent response format for interoperability:
- Structured output schema for tool results
- Provider-agnostic response payloads
- Enables cross-provider agent result consumption
- Reference: `docs/agents/policy.contract.yaml` for capability gate

## Deterministic Runtime Rules
1. Prefer Responses-native tool flows for agent tasks.
2. Prefer MCP context before web lookup when repo/runtime truth is local.
3. Keep `AGENTS.md` highest policy source; adapter text is compatibility-only.
4. Emit verification commands and outcomes for each completed task.
5. Emit runtime evidence when falling back from an unavailable capability.
6. Reference `.agents/workflows/` for step-by-step execution patterns.
7. For OpenAI docs queries, route to `directstock-context7` or `directstock-fetch` against `platform.openai.com`.
8. Documentation answers must include source URLs and a verification timestamp (`verified on <UTC date>`).

## Ralph Runtime Parity
`direct ralph` must stay aligned with Codex CLI behavior:
1. Non-interactive execution uses `codex exec --json --dangerously-bypass-approvals-and-sandbox -s danger-full-access`.
2. Planner schema mode uses `--output-schema <path>` when available, otherwise explicit fallback to prompt+Zod validation.
3. Reasoning tier is mapped via `-c model_reasoning_effort="<medium|high|xhigh>"`.
4. Resume mode uses `codex exec resume <session-id>` and persists thread ID in `metadata.resumeSessionId`.
5. Capability probe is executed before loop start; strict mode: `--strict-provider-capabilities`.

## MCP Configuration
Codex CLI uses `.codex/config.toml` for MCP server configuration:
```toml
[mcp]
servers = ["directstock-filesystem", "directstock-postgres", "directstock-github"]
```
Cross-reference with `.mcp.json` (Claude format) for parity.

## Codex App Integration (Feb 2026)
The macOS Codex App reads `codex.json` at repository root for native project integration:
- Default reasoning effort, allowed paths, MCP profile binding
- Parallel agent hints for frontend/backend/governance scopes
- See `codex.json` for the project-specific configuration

## GitHub Agentic Workflows
GitHub supports Codex agents triggered from Actions (technical preview, Feb 2026):
- Define agent tasks in `.github/agentic-workflows/` (YAML + Markdown)
- Use for automated issue triage, documentation maintenance, code quality checks
- Agents inherit `AGENTS.md` as their instruction set

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
