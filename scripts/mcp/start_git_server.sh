#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if command -v uvx >/dev/null 2>&1; then
  exec uvx mcp-server-git --repository "${ROOT_DIR}"
fi

echo "uvx is required to start git MCP server (mcp-server-git)." >&2
exit 1
