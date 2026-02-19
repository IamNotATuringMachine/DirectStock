#!/usr/bin/env bash
set -euo pipefail
MCP_MEMORY_VERSION="${MCP_MEMORY_VERSION:-2026.1.26}"
NPM_CACHE_DIR="${NPM_CACHE_DIR:-${TMPDIR:-/tmp}/directstock-npm-cache}"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required to start memory MCP server." >&2
  exit 1
fi

mkdir -p "${NPM_CACHE_DIR}"

exec npx --cache "${NPM_CACHE_DIR}" -y "@modelcontextprotocol/server-memory@${MCP_MEMORY_VERSION}"
