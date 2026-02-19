#!/usr/bin/env bash
set -euo pipefail
MCP_PLAYWRIGHT_VERSION="${MCP_PLAYWRIGHT_VERSION:-0.0.68}"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required to start playwright MCP server." >&2
  exit 1
fi

exec npx -y "@playwright/mcp@${MCP_PLAYWRIGHT_VERSION}"
