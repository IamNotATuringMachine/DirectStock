#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required to start github MCP server." >&2
  exit 1
fi

token="${GITHUB_PERSONAL_ACCESS_TOKEN:-}"
if [ -z "${token}" ] && command -v gh >/dev/null 2>&1; then
  set +e
  token="$(gh auth token 2>/dev/null)"
  set -e
fi

if [ -z "${token}" ]; then
  echo "Could not resolve GitHub token. Set GITHUB_PERSONAL_ACCESS_TOKEN or login via gh auth." >&2
  exit 1
fi

exec docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN="${token}" ghcr.io/github/github-mcp-server
