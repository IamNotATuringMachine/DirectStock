# MCP Stack Strategy (DirectStock, 2026.1)

## Goal
Provide reliable live context for autonomous agents across code, database, delivery workflows, UI validation, and durable memory.

This repository runs in `unrestricted_senior` mode:
1. Agents may execute high-risk actions without approval prompts.
2. MCP guardrails are documentary/forensic defaults, not blocking controls.
3. High-risk execution rationale and rollback hints must be recorded in `docs/agents/decision-log.md`.

## Audit 2026-02-19 (Baseline)
1. **Hard deprecated (resolved):**
   - Archived npm PostgreSQL MCP runtime is removed.
   - Active runtime is in-repo Python server (`scripts/mcp/directstock_postgres_server.py`).
2. **Best-practice debt (addressed by this guide):**
   - deterministic version pins for MCP wrappers
   - GitHub MCP hardening defaults (read-only + toolsets)
   - optional hybrid overlay for GitHub remote MCP endpoint

## Recommended MCP Servers
1. Filesystem MCP: repository-local code and docs context.
2. PostgreSQL MCP: read-only diagnostics against local/dev DB.
3. GitHub MCP: issue/PR/review context and governance automation.
4. Playwright MCP: deterministic browser-flow checks.
5. Git MCP: commit/diff/blame context for history-aware agents.
6. Memory MCP: cross-task context continuity for long-running autonomous workflows.
7. OpenAI Docs MCP: provider-official OpenAI documentation via remote MCP endpoint.
8. Context7 MCP: framework/library documentation retrieval (React/FastAPI/Vite/TanStack/etc.).
9. Fetch MCP: standards-based fallback for official docs pages when provider/framework MCP coverage is missing.

## Repository MCP Profiles (`.mcp.json`)
1. `dev-autonomy`: full topology + memory for local autonomous execution.
2. `dev-full`: compatibility alias for legacy tooling (same topology as `dev-autonomy`).
3. `ci-readonly`: CI topology with mandatory PostgreSQL read-only posture.
4. `triage-readonly`: low-blast-radius incident triage profile.
5. `review-governance`: governance review profile (filesystem + github + git).
6. `docs-research`: docs-first profile (`filesystem`, `github`, `git`, `memory`, `openai-docs`, `context7`, `fetch`).

Selection examples:
```bash
MCP_PROFILE=dev-autonomy ./scripts/check_mcp_readiness.sh
MCP_PROFILE=triage-readonly MCP_REQUIRE_POSTGRES_READONLY=1 ./scripts/check_mcp_readiness.sh
MCP_PROFILE=ci-readonly MCP_REQUIRE_POSTGRES_READONLY=1 ./scripts/check_mcp_readiness.sh
MCP_PROFILE=docs-research ./scripts/check_mcp_readiness.sh
```

## Read-Only PostgreSQL Policy
1. MCP PostgreSQL DSN user must end with `_ro`.
2. Emergency override is explicit only: `MCP_REQUIRE_POSTGRES_READONLY=0`.
3. Runtime uses the in-repo server `scripts/mcp/directstock_postgres_server.py` (Python MCP SDK + psycopg), not the deprecated npm PostgreSQL MCP package.
4. Bootstrap helper:
```bash
./scripts/mcp/bootstrap_postgres_readonly_role.sh
```
5. Set `.env` / `.env.example`:
```bash
MCP_POSTGRES_DSN=postgresql://directstock_ro:directstock_ro@localhost:5432/directstock_clean
MCP_REQUIRE_POSTGRES_READONLY=1
```

## Codex Example (`~/.codex/config.toml`)
```toml
[mcp_servers.filesystem]
command = "bash"
args = ["-lc", "exec /Users/tobiasmorixbauer/Documents/GitHub/DirectStock/scripts/mcp/start_filesystem_server.sh"]

[mcp_servers.postgres]
command = "bash"
args = ["-lc", "exec /Users/tobiasmorixbauer/Documents/GitHub/DirectStock/scripts/mcp/start_postgres_server.sh"]

[mcp_servers.github]
command = "bash"
args = ["-lc", "exec /Users/tobiasmorixbauer/Documents/GitHub/DirectStock/scripts/mcp/start_github_server.sh"]

[mcp_servers.playwright]
command = "bash"
args = ["-lc", "exec /Users/tobiasmorixbauer/Documents/GitHub/DirectStock/scripts/mcp/start_playwright_server.sh"]

[mcp_servers.git]
command = "bash"
args = ["-lc", "exec /Users/tobiasmorixbauer/Documents/GitHub/DirectStock/scripts/mcp/start_git_server.sh"]

[mcp_servers.memory]
command = "bash"
args = ["-lc", "exec /Users/tobiasmorixbauer/Documents/GitHub/DirectStock/scripts/mcp/start_memory_server.sh"]
```

## Multi-CLI Bootstrap
Register the same server set across Codex, Claude, and Gemini:
```bash
./scripts/setup_mcp_multi_cli.sh
```
This bootstrap configures `postgres` for Codex by default (no feature flag toggle).

Antigravity project profile mirror:
1. `.idx/mcp.json` mirrors `dev-autonomy`, `triage-readonly`, `review-governance`, and `docs-research`.
2. Keep profile names aligned with `.mcp.json` to avoid tooling drift.
3. `.idx/airules.md` defines Antigravity IDE behavior and mandatory UI/UX artifact reporting.

Wrappers:
1. `scripts/mcp/start_filesystem_server.sh`
2. `scripts/mcp/start_postgres_server.sh`
3. `scripts/mcp/start_github_server.sh`
4. `scripts/mcp/start_playwright_server.sh`
5. `scripts/mcp/start_git_server.sh`
6. `scripts/mcp/start_memory_server.sh`
7. `scripts/mcp/start_openai_docs_server.sh`
8. `scripts/mcp/start_context7_server.sh`
9. `scripts/mcp/start_fetch_server.sh`
10. PostgreSQL MCP runtime: `scripts/mcp/directstock_postgres_server.py`
11. Optional GitHub remote overlay: `scripts/mcp/setup_github_remote_overlay.sh`

## Deterministic MCP Version Pinning
Default wrapper pins (override via env variables if needed):
1. `MCP_FILESYSTEM_VERSION=2026.1.14`
2. `MCP_MEMORY_VERSION=2026.1.26`
3. `MCP_PLAYWRIGHT_VERSION=0.0.68`
4. `MCP_GIT_VERSION=2026.1.14`
5. `GITHUB_MCP_IMAGE=ghcr.io/github/github-mcp-server:v0.31.0`
6. `MCP_CONTEXT7_VERSION=2.1.1`
7. `MCP_FETCH_VERSION=2025.4.7`
8. `MCP_REMOTE_VERSION=0.1.38`
9. `OPENAI_DOCS_MCP_URL=https://mcp.openai.com/mcp`

Pinning applies to startup wrappers and readiness probes to keep local and CI behavior reproducible.

## Documentation Routing Policy (Hybrid)
1. OpenAI platform/API questions: `directstock-openai-docs` first.
2. Framework/library questions: `directstock-context7` first.
3. Claude/Gemini provider docs and uncovered sources: `directstock-fetch` against official docs domains.
4. Fallback sequence: if preferred docs server fails, fallback to `directstock-fetch` and log fallback path in task output.

Official docs domain allowlist baseline:
1. `platform.openai.com`
2. `docs.anthropic.com`
3. `ai.google.dev`
4. `google.github.io`

Response evidence requirements:
1. Include source URLs for documentation-based answers.
2. Include verification timestamp (`verified on <UTC date>`).
3. Prefer pages with explicit update metadata when available.

## GitHub MCP Hardening Defaults
`scripts/mcp/start_github_server.sh` applies profile-aware defaults if env vars are unset:
1. `GITHUB_READ_ONLY`
   - `1` for `ci-readonly`, `triage-readonly`, `review-governance`
   - `0` for `dev-autonomy` / `dev-full`
2. `GITHUB_TOOLSETS`
   - `repos,issues,pull_requests,actions,code_security` for `ci-readonly` + `review-governance`
   - `repos,issues,pull_requests` for `triage-readonly`
   - `all` for `dev-autonomy` / `dev-full`

`check_mcp_readiness.sh` now reports effective GitHub hardening (image pin, read-only mode, toolsets) in probe notes.

## Hybrid GitHub MCP Strategy (Local + Remote)
Local GitHub MCP remains default in `.mcp.json`, `.idx/mcp.json`, and `.gemini/settings.json`.

Optional remote overlay (read-only endpoint):
```bash
./scripts/mcp/setup_github_remote_overlay.sh
```

This registers `directstock-github-remote` in Codex, Claude, and Gemini:
- `https://api.githubcopilot.com/mcp/readonly`
- Overlay writes user-scoped entries for Claude/Gemini and keeps repository defaults in `.mcp.json` / `.gemini/settings.json` unchanged.

Recommended use:
1. local Docker MCP for standard development and repository-local flows
2. remote read-only overlay for cloud/CI-style agent runs or environments where local Docker is unavailable

## Validation Checklist
1. MCP server starts without auth/runtime errors.
2. One read operation succeeds per configured server.
3. Secrets are supplied via environment variables, never committed.
4. Agent logs identify which MCP server supplied critical context.

## Automated Preflight
```bash
MCP_PROBE_ALLOW_BLOCKED=1 ./scripts/check_mcp_readiness.sh
MCP_PROFILE=ci-readonly MCP_REQUIRE_POSTGRES_READONLY=1 MCP_PROBE_ALLOW_BLOCKED=0 ./scripts/check_mcp_readiness.sh
```

Output:
1. `docs/validation/metrics/mcp-readiness-latest.md`
