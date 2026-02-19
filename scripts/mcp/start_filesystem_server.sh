#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required to start filesystem MCP server." >&2
  exit 1
fi

exec npx -y @modelcontextprotocol/server-filesystem "${ROOT_DIR}"
