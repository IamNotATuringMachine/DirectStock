#!/usr/bin/env bash
set -euo pipefail

MCP_FETCH_VERSION="${MCP_FETCH_VERSION:-2025.4.7}"
UV_CACHE_DIR="${UV_CACHE_DIR:-${TMPDIR:-/tmp}/directstock-uv-cache}"

if command -v uv >/dev/null 2>&1; then
  mkdir -p "${UV_CACHE_DIR}"
  export UV_CACHE_DIR
  exec uv run --quiet --with "mcp-server-fetch==${MCP_FETCH_VERSION}" mcp-server-fetch
fi

echo "uv is required to start fetch MCP server (mcp-server-fetch)." >&2
exit 1
