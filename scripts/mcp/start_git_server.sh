#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MCP_GIT_VERSION="${MCP_GIT_VERSION:-2026.1.14}"
UV_CACHE_DIR="${UV_CACHE_DIR:-${TMPDIR:-/tmp}/directstock-uv-cache}"

if command -v uv >/dev/null 2>&1; then
  mkdir -p "${UV_CACHE_DIR}"
  export UV_CACHE_DIR
  exec uv run --quiet --with "mcp-server-git==${MCP_GIT_VERSION}" mcp-server-git --repository "${ROOT_DIR}"
fi

echo "uv is required to start git MCP server (mcp-server-git)." >&2
exit 1
