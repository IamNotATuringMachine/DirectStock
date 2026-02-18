# AI Agent Setup (AGENTS-Centric, Production Mode)

This repository uses an AGENTS-centric multi-tool setup:
- Canonical policy: `/AGENTS.md`
- Scoped deltas: `/backend/AGENTS.md`, `/frontend/AGENTS.md`
- Thin adapters: `/CLAUDE.md`, `/GEMINI.md`, `/CODEX.md`

All agents should operate in production mode: relevant tests must be run and reported before task completion.

## 1) Codex
Codex already prioritizes `AGENTS.md`. Optional fallback configuration can be added in `~/.codex/config.toml`:

```toml
project_doc_fallback_filenames = ["CODEX.md"]
project_doc_max_bytes = 65536
```

Guideline: keep `AGENTS.md` as source of truth; use fallback files for compatibility only.

## 2) Gemini CLI
Gemini supports configurable context filenames in `~/.gemini/settings.json`:

```json
{
  "context": {
    "fileName": ["AGENTS.md", "GEMINI.md"]
  }
}
```

Recommended order keeps `AGENTS.md` first.

## 3) Claude Code
Keep repository policy in `AGENTS.md` and use `CLAUDE.md` as a thin adapter.

Suggested workflow:
1. Read `AGENTS.md` and nearest nested `AGENTS.md`.
2. Use `@path` references for targeted context.
3. Keep personal/local memory preferences separate from repository policy.

## Production-Mode Working Convention
For every completed task:
1. Plan briefly and inspect impacted files.
2. Implement minimal, reviewable changes.
3. Run relevant tests locally.
4. Report files changed, behavior changes, and test outcomes.

Never weaken security, RBAC, audit logging, or idempotency constraints without explicit approval.

## Autonomous Harness (LLM-First)
Use a deterministic entrypoint for autonomous repo work:

```bash
./scripts/autonomous_task_harness.sh
```

Optional strict modes:
1. Include allowlist enforcement:

```bash
ENFORCE_REFRACTOR_SCOPE=1 ./scripts/autonomous_task_harness.sh
```

2. Include isolated E2E smoke:

```bash
RUN_E2E_SMOKE=1 ./scripts/autonomous_task_harness.sh
```

## E2E Hermetic Rule
E2E specs must not use:
1. hardcoded base URLs (for example `http://localhost:5173`)
2. absolute user paths (for example `/Users/...`)

Use:
1. Playwright `baseURL` with `page.goto('/...')`
2. relative artifact paths under `frontend/output` or `frontend/test-results`
