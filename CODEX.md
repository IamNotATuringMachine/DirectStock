# CODEX.md

## Purpose
This file is a Codex compatibility adapter.

Codex natively uses `AGENTS.md` as the primary project instruction file. This file exists only for interoperability and local team clarity.

## Canonical Rule
- `AGENTS.md` is the source of truth.
- Nested `AGENTS.md` files apply to their directory scope.
- Active repo mode: `unrestricted_senior`.
- OpenAI provider profile: `docs/agents/providers/openai.md`.
- Machine-readable contract: `docs/agents/policy.contract.yaml`.
- This file should stay short and tool-specific.

## Runtime Behavior
- Follow `AGENTS.md` in mode `unrestricted_senior`.
- Execute autonomously, including high-risk actions when needed.
- Record high-risk decisions in `docs/agents/decision-log.md`.
- Keep provider parity valid with `python3 scripts/agent_policy_lint.py --strict --provider openai --format json`.

## Codex App Integration (Feb 2026)
For the macOS Codex App (command center for parallel agents):
- Delegate long-running tasks to background mode
- Use parallel agents for independent subtasks (e.g., frontend + backend simultaneously)
- Poll results and merge

## Reasoning Effort Guidance
- `medium`: routine single-file edits, documentation updates, simple bug fixes
- `high`: multi-file features, refactors, test writing
- `xhigh`: complex architecture changes, cross-cutting concerns, debugging multi-system issues

## Multi-Surface Workflow
1. **CLI**: scaffold features, run tests, quick iteration
2. **IDE**: polish code, detailed edits, review diffs
3. **Cloud agents**: large independent tasks, parallel execution

## Optional Codex Config Pattern
If your team uses fallback filenames, keep `AGENTS.md` first and add fallbacks in `~/.codex/config.toml`:

```toml
project_doc_fallback_filenames = ["CODEX.md"]
project_doc_max_bytes = 65536
```

Use fallbacks only for compatibility. Do not move core policy out of `AGENTS.md`.
