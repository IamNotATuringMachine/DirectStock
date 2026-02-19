#!/usr/bin/env bash
set -euo pipefail
MCP_MEMORY_VERSION="${MCP_MEMORY_VERSION:-2026.1.26}"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required to start memory MCP server." >&2
  exit 1
fi

exec npx -y "@modelcontextprotocol/server-memory@${MCP_MEMORY_VERSION}"
