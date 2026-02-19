# MCP Stack Strategy (DirectStock, 2026)

## Goal
Provide reliable live context for autonomous agents across code, database, delivery workflows, and UI validation.

## Recommended MCP Servers
1. Filesystem MCP: repository-local code and docs context.
2. PostgreSQL MCP: read-only data diagnostics against local/dev DB.
3. GitHub MCP: issue/PR/review context and governance automation.
4. Playwright MCP: deterministic browser flow checks.

## Balanced Security Defaults
1. Restrict filesystem root to repo path only.
2. Use read-only DB role for MCP by default.
3. Scope tokens minimally and avoid long-lived secrets in repo.
4. Prefer stdio transport for local execution.

## Codex Example (`~/.codex/config.toml`)
```toml
[mcp_servers.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/Users/tobiasmorixbauer/Documents/GitHub/DirectStock"]

[mcp_servers.postgres]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-postgres", "postgresql://directstock_ro:***@localhost:5432/directstock_clean"]

[mcp_servers.github]
command = "docker"
args = ["run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN", "ghcr.io/github/github-mcp-server"]

[mcp_servers.playwright]
command = "npx"
args = ["-y", "@playwright/mcp@latest"]
```

## Claude Example (local scope)
```bash
claude mcp add-json --scope local filesystem '{"type":"stdio","command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","/Users/tobiasmorixbauer/Documents/GitHub/DirectStock"]}'
```

## Gemini Example (user scope)
```bash
gemini mcp add --scope user filesystem npx -y @modelcontextprotocol/server-filesystem /Users/tobiasmorixbauer/Documents/GitHub/DirectStock
```

## Validation Checklist
1. MCP server starts without auth/runtime errors.
2. One read operation succeeds per server.
3. Secrets are supplied via environment variables, never committed.
4. Agent task logs include which MCP server supplied critical context.

## Automated Preflight
Use the repo script to generate a readiness snapshot:

```bash
MCP_PROBE_ALLOW_BLOCKED=1 ./scripts/check_mcp_readiness.sh
```

Output:
- `docs/validation/metrics/mcp-readiness-latest.md`

Optional env vars for full probes:
- `MCP_POSTGRES_DSN`
- `GITHUB_PERSONAL_ACCESS_TOKEN`

## Multi-CLI Bootstrap (Codex + Claude + Gemini)
Use one shared setup script to register the same 4 MCP servers across all installed CLIs:

```bash
./scripts/setup_mcp_multi_cli.sh
```

What it configures:
1. Codex (`~/.codex/config.toml`): adds missing `filesystem`, `postgres`, `github`, `playwright` entries.
2. Claude Code (project scope): `directstock-filesystem`, `directstock-postgres`, `directstock-github`, `directstock-playwright`.
3. Gemini CLI (project scope): same server names as Claude for parity.

Wrappers used by all CLIs:
- `scripts/mcp/start_filesystem_server.sh`
- `scripts/mcp/start_postgres_server.sh`
- `scripts/mcp/start_github_server.sh`
- `scripts/mcp/start_playwright_server.sh`

Verification:
```bash
claude mcp list
gemini mcp list
MCP_PROBE_ALLOW_BLOCKED=0 ./scripts/check_mcp_readiness.sh
```
