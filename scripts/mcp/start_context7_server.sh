#!/usr/bin/env bash
set -euo pipefail

MCP_CONTEXT7_VERSION="${MCP_CONTEXT7_VERSION:-2.1.1}"
NPM_CACHE_DIR="${NPM_CACHE_DIR:-${TMPDIR:-/tmp}/directstock-npm-cache}"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required to start Context7 MCP server." >&2
  exit 1
fi

mkdir -p "${NPM_CACHE_DIR}"

exec npx --cache "${NPM_CACHE_DIR}" -y "@upstash/context7-mcp@${MCP_CONTEXT7_VERSION}"
