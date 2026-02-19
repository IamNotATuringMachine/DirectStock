#!/usr/bin/env bash
set -euo pipefail

MCP_REMOTE_VERSION="${MCP_REMOTE_VERSION:-0.1.38}"
OPENAI_DOCS_MCP_URL="${OPENAI_DOCS_MCP_URL:-https://mcp.openai.com/mcp}"
NPM_CACHE_DIR="${NPM_CACHE_DIR:-${TMPDIR:-/tmp}/directstock-npm-cache}"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required to start OpenAI docs MCP server." >&2
  exit 1
fi

mkdir -p "${NPM_CACHE_DIR}"

exec npx --cache "${NPM_CACHE_DIR}" -y "mcp-remote@${MCP_REMOTE_VERSION}" "${OPENAI_DOCS_MCP_URL}"
