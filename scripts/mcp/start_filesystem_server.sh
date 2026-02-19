#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MCP_FILESYSTEM_VERSION="${MCP_FILESYSTEM_VERSION:-2026.1.14}"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required to start filesystem MCP server." >&2
  exit 1
fi

exec npx -y "@modelcontextprotocol/server-filesystem@${MCP_FILESYSTEM_VERSION}" "${ROOT_DIR}"
