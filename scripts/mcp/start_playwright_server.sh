#!/usr/bin/env bash
set -euo pipefail

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required to start playwright MCP server." >&2
  exit 1
fi

exec npx -y @playwright/mcp@latest
