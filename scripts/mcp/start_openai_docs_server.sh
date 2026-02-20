#!/usr/bin/env bash
set -euo pipefail

MCP_REMOTE_VERSION="${MCP_REMOTE_VERSION:-0.1.38}"
OPENAI_DOCS_MCP_URL="${OPENAI_DOCS_MCP_URL:-https://mcp.openai.com/mcp}"
NPM_CACHE_DIR="${NPM_CACHE_DIR:-${TMPDIR:-/tmp}/directstock-npm-cache}"
OPENAI_DOCS_MCP_STRATEGY="${OPENAI_DOCS_MCP_STRATEGY:-auto}"
OPENAI_DOCS_ALLOW_INTERACTIVE_OAUTH="${OPENAI_DOCS_ALLOW_INTERACTIVE_OAUTH:-0}"
OPENAI_DOCS_AUTH_TOKEN="${OPENAI_DOCS_AUTH_TOKEN:-${OPENAI_API_KEY:-}}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FETCH_WRAPPER="${ROOT_DIR}/scripts/mcp/start_fetch_server.sh"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required to start OpenAI docs MCP server." >&2
  exit 1
fi

mkdir -p "${NPM_CACHE_DIR}"

run_remote_with_oauth() {
  exec npx --cache "${NPM_CACHE_DIR}" -y "mcp-remote@${MCP_REMOTE_VERSION}" "${OPENAI_DOCS_MCP_URL}"
}

run_remote_with_header() {
  exec npx --cache "${NPM_CACHE_DIR}" -y "mcp-remote@${MCP_REMOTE_VERSION}" \
    "${OPENAI_DOCS_MCP_URL}" \
    --header "Authorization:Bearer ${OPENAI_DOCS_AUTH_TOKEN}"
}

run_fetch_fallback() {
  if [ ! -x "${FETCH_WRAPPER}" ]; then
    echo "Fetch fallback wrapper is missing or not executable: ${FETCH_WRAPPER}" >&2
    exit 1
  fi
  echo "OpenAI docs MCP fallback: using directstock-fetch (no auth token and interactive OAuth disabled)." >&2
  exec "${FETCH_WRAPPER}"
}

case "${OPENAI_DOCS_MCP_STRATEGY}" in
  remote)
    if [ -n "${OPENAI_DOCS_AUTH_TOKEN}" ]; then
      run_remote_with_header
    fi
    run_remote_with_oauth
    ;;
  fetch-fallback)
    run_fetch_fallback
    ;;
  auto)
    if [ -n "${OPENAI_DOCS_AUTH_TOKEN}" ]; then
      run_remote_with_header
    fi
    if [ "${OPENAI_DOCS_ALLOW_INTERACTIVE_OAUTH}" = "1" ]; then
      run_remote_with_oauth
    fi
    run_fetch_fallback
    ;;
  *)
    echo "Invalid OPENAI_DOCS_MCP_STRATEGY='${OPENAI_DOCS_MCP_STRATEGY}'. Use: auto, remote, fetch-fallback." >&2
    exit 1
    ;;
esac
