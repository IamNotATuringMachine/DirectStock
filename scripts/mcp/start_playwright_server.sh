#!/usr/bin/env bash
set -euo pipefail
MCP_PLAYWRIGHT_VERSION="${MCP_PLAYWRIGHT_VERSION:-0.0.68}"
NPM_CACHE_DIR="${NPM_CACHE_DIR:-${TMPDIR:-/tmp}/directstock-npm-cache}"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required to start playwright MCP server." >&2
  exit 1
fi

mkdir -p "${NPM_CACHE_DIR}"

exec npx --cache "${NPM_CACHE_DIR}" -y "@playwright/mcp@${MCP_PLAYWRIGHT_VERSION}"
