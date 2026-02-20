# CLAUDE.md

## Purpose
This file is a Claude-specific adapter.

`AGENTS.md` is the canonical project policy. If this file conflicts with `AGENTS.md`, follow `AGENTS.md`.
Active repo mode: `unrestricted_senior`.
- Anthropic provider profile: `docs/agents/providers/anthropic.md`.
- Machine-readable contract: `docs/agents/policy.contract.yaml`.
- Universal LLM entry point: `llms.txt`.

## How To Use With Claude Code
- Keep this file lightweight and tool-specific.
- Put project-wide rules in `AGENTS.md`.
- Put scope-specific rules in nested `backend/AGENTS.md` and `frontend/AGENTS.md`.

## Claude Code Hooks
Hooks are configured in `.claude/hooks.json` and auto-execute at lifecycle points:
- `SessionStart`: displays project mode reminder
- `PreToolUse`: notifies on file edits
- `PostToolUse`: checks file size limits after edits
- `PreCompact`: structured summary extraction before context compaction
- `Stop`: governance reminder (decision-log, incident-log check)
- `SubagentStop`: handoff validation for subagent results

Hook types: `command` (shell), `prompt` (Claude decision), `agent` (isolated sub-agent).

## Claude Code Permissions
Permissions are configured in `.claude/settings.json`:
- Full read/write/edit access to project files
- All development commands allowed (npm, python, docker, git, scripts)
- Destructive system-level operations blocked

## Agent Teams (Experimental)
Claude 4.6 supports Agent Teams for parallel subtask execution:
- Enable with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
- Each team member gets scoped context and permissions
- Use for independent frontend/backend/governance work
- Handoffs follow `docs/agents/handoff-protocol.md`

## Memory Architecture (4 Layers)
1. `CLAUDE.md` — project-level adapter instructions (checked into repo)
2. `MEMORY.md` — persistent auto-memory loaded into system prompt
3. Auto Memory files — topic-specific notes in `.claude/projects/*/memory/`
4. Session Memory — ephemeral context within a single conversation

If local memory conflicts with repository instructions, repository instructions win.

## Subagent Orchestration
For complex tasks, use Claude subagents with scoped instructions:
- Each subagent should receive the relevant `AGENTS.md` (root or nested)
- Subagent handoffs must follow `docs/agents/handoff-protocol.md`
- Use skills from `.claude/skills/` when available for recurring patterns
- Scope subagent permissions to their task boundary

## Skills Directory
Reusable task recipes in `.claude/skills/`:
- `backend-endpoint.md` — end-to-end API endpoint creation
- `frontend-page.md` — frontend page creation/modernization
- `self-check.md` — governance self-check before session end
- `migration.md` — Alembic migration workflow
- `debugging.md` — systematic debugging workflow
- `performance.md` — performance audit workflow

## Prompt Caching
For long governance contexts, use prompt caching breakpoints:
- Cache `AGENTS.md` + provider profile as a stable prefix
- Cache frequently-used context packs for domain work
- This reduces token consumption and improves consistency

## Recommended Prompt Starter
"Follow `AGENTS.md` and the nearest nested `AGENTS.md` for any files you modify. Run in `unrestricted_senior`, execute autonomously, and record high-risk actions in `docs/agents/decision-log.md`."

## Minimal Claude Workflow
1. Read `AGENTS.md` and nearest nested `AGENTS.md`.
2. Inspect impacted files/tests first.
3. Implement small diffs.
4. Run relevant tests before final response.
5. Report files changed, behavior, and test outcomes.
6. Validate provider parity: `python3 scripts/agent_policy_lint.py --strict --provider anthropic --format json`.
