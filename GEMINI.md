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

## Gemini CLI Setup Hint
Gemini CLI can load multiple context filenames. Configure `context.fileName` so `AGENTS.md` is included:

```json
{
  "context": {
    "fileName": ["AGENTS.md", "GEMINI.md", "frontend/AGENTS.md"]
  }
}
```

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
