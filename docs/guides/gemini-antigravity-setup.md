# Gemini CLI + Antigravity Setup (DirectStock, 2026.1)

## Goal
One project-local setup for Gemini CLI and Antigravity with identical MCP topology and predictable UI/UX quality gates.

## Profiles and Mapping
| Purpose | Repo profile (`.mcp.json`) | Gemini CLI (`.gemini/settings.json`) | Antigravity (`.idx/mcp.json`) |
| --- | --- | --- | --- |
| Full autonomous dev | `dev-autonomy` | `mcpServers` full set | `dev-autonomy` |
| Incident triage (read-only DB) | `triage-readonly` | same server set + runtime env | `triage-readonly` |
| Governance/review | `review-governance` | subset allowed by run policy | `review-governance` |

Required MCP servers:
1. `directstock-filesystem`
2. `directstock-postgres`
3. `directstock-github`
4. `directstock-playwright`
5. `directstock-git`
6. `directstock-memory`

## Bootstrap
1. Register MCP servers across CLIs:
```bash
./scripts/setup_mcp_multi_cli.sh
```
2. Validate Gemini runtime:
```bash
./scripts/check_gemini_readiness.sh --mode runtime
```
3. Enforce runtime allowlist (no extra connected MCP servers):
```bash
./scripts/check_gemini_readiness.sh --mode runtime --enforce-allowlist
```
4. Validate Gemini static parity (CI-equivalent):
```bash
./scripts/check_gemini_readiness.sh --mode static
python3 scripts/check_mcp_profile_parity.py --strict --format json
```
5. Validate repository MCP posture:
```bash
MCP_PROFILE=dev-autonomy MCP_PROBE_ALLOW_BLOCKED=1 ./scripts/check_mcp_readiness.sh
```

## Context Files
Gemini context filenames should include:
1. `AGENTS.md`
2. `GEMINI.md`
3. `frontend/AGENTS.md`

Antigravity and Gemini should both resolve project policy from `AGENTS.md` first.

## UI/UX Quality Gates (Mandatory)
For frontend UI/UX changes run:
1. `cd frontend && npm run test:e2e:a11y -- --project=web-desktop`
2. `cd frontend && npm run test:e2e:visual -- --project=web-desktop`
3. `cd frontend && npm run test:e2e:a11y:mobile`
4. `cd frontend && npm run test:e2e:visual:mobile`
5. `./scripts/check_design_token_drift.sh`

## Fallback Rules
1. If Gemini MCP memory is unavailable, proceed with filesystem/git/github context and capture the fallback in task output.
2. If external design SaaS is unavailable, use local token drift + Playwright visual diff gates as mandatory fallback.
3. Keep PostgreSQL MCP read-only by default (`MCP_REQUIRE_POSTGRES_READONLY=1`).

## Antigravity Behavior Contract
Antigravity project behavior requirements are defined in `.idx/airules.md`.
