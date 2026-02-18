# CLAUDE.md

## Purpose
This file is a Claude-specific adapter.

`AGENTS.md` is the canonical project policy. If this file conflicts with `AGENTS.md`, follow `AGENTS.md`.

## How To Use With Claude Code
- Keep this file lightweight and tool-specific.
- Put project-wide rules in `AGENTS.md`.
- Put scope-specific rules in nested `backend/AGENTS.md` and `frontend/AGENTS.md`.

## Claude Memory Pattern
- You can reference files with `@path` in prompts when needed.
- Keep reusable persistent preferences in Claude local memory, but do not duplicate repository policy there.
- If local memory conflicts with repository instructions, repository instructions win.

## Recommended Prompt Starter
"Follow `AGENTS.md` and the nearest nested `AGENTS.md` for any files you modify. Keep changes additive, run relevant tests, and report verification results."

## Minimal Claude Workflow
1. Read `AGENTS.md` and nearest nested `AGENTS.md`.
2. Inspect impacted files/tests first.
3. Implement small diffs.
4. Run relevant tests before final response.
5. Report files changed, behavior, and test outcomes.
