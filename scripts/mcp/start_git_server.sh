#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MCP_GIT_VERSION="${MCP_GIT_VERSION:-2026.1.14}"

if command -v uvx >/dev/null 2>&1; then
  exec uvx --from "mcp-server-git==${MCP_GIT_VERSION}" mcp-server-git --repository "${ROOT_DIR}"
fi

echo "uvx is required to start git MCP server (mcp-server-git)." >&2
exit 1
