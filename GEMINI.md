# GEMINI.md

## Purpose
This file is a Gemini CLI-specific adapter.

`AGENTS.md` is the canonical project policy. Treat this file as configuration guidance only.
Active repo mode: `unrestricted_senior`.
- Google provider profile: `docs/agents/providers/google.md`.
- Machine-readable contract: `docs/agents/policy.contract.yaml`.

## Context Strategy
- Keep project rules in `AGENTS.md`.
- Use nested `backend/AGENTS.md` and `frontend/AGENTS.md` for scoped deltas.
- Avoid duplicating policy text in this file.

## Context Imports
Load these files for full project context at session start:

@.ai-context.md
@backend/AGENTS.md
@frontend/AGENTS.md
@docs/agents/repo-map.md
@docs/agents/change-playbooks.md
@docs/agents/patterns.md

## Gemini CLI Setup Hint
Gemini CLI can load multiple context filenames. Configure `context.fileName` so `AGENTS.md` is included:

```json
{
  "context": {
    "fileName": ["AGENTS.md", "GEMINI.md", "frontend/AGENTS.md", "backend/AGENTS.md"]
  }
}
```

## Non-Interactive Mode
For automated/CI workflows, use Gemini CLI with prompt mode and JSON output:
```bash
gemini -p "Follow AGENTS.md. Task: <description>" --output-format json --approval-mode yolo
```

## Conversation Checkpointing
For long-running tasks, use conversation checkpointing to preserve state:
- Checkpoint after each major subtask completion
- Include verification results in checkpoint context
- Resume from last checkpoint on failure

## Operational Notes
- When editing files, follow the nearest applicable `AGENTS.md`.
- Run in `unrestricted_senior`: execute autonomously, including high-risk changes when needed.
- Treat completion as production-mode only: run relevant tests and report outcomes.
- Record high-risk decisions in `docs/agents/decision-log.md`.
- Validate provider parity: `python3 scripts/agent_policy_lint.py --strict --provider google --format json`.
- Validate Gemini runtime readiness: `./scripts/check_gemini_readiness.sh --mode runtime`.
- Enforce runtime MCP allowlist (no extra connected servers): `./scripts/check_gemini_readiness.sh --mode runtime --enforce-allowlist`.
- Validate Gemini static parity for CI-equivalent checks: `./scripts/check_gemini_readiness.sh --mode static` and `python3 scripts/check_mcp_profile_parity.py --strict --format json`.
- For frontend UI/UX changes, run desktop and mobile gates:
  - `cd frontend && npm run test:e2e:a11y -- --project=web-desktop`
  - `cd frontend && npm run test:e2e:visual -- --project=web-desktop`
  - `cd frontend && npm run test:e2e:a11y:mobile`
  - `cd frontend && npm run test:e2e:visual:mobile`

## ADK Workflow Patterns
When using Google ADK for multi-agent orchestration:
1. Model each task as an explicit state transition
2. Use sequential agent for ordered subtasks, parallel agent for independent work
3. Package repeatable patterns as deterministic execution contracts
4. Handoffs must follow `docs/agents/handoff-protocol.md`

## A2A Interoperability
For Agent-to-Agent communication:
1. Use schema-disciplined payloads (see `docs/agents/handoff.schema.json`)
2. Implement capability probing before delegation
3. Use protocol adapters with graceful fallbacks
4. Keep transport-agnostic — don't couple to specific MCP implementation
