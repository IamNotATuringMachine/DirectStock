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

profile="${MCP_PROFILE:-dev-autonomy}"
github_mcp_image="${GITHUB_MCP_IMAGE:-ghcr.io/github/github-mcp-server:v0.31.0}"

github_read_only="${GITHUB_READ_ONLY:-}"
if [ -z "${github_read_only}" ]; then
  case "${profile}" in
    ci-readonly|triage-readonly|review-governance) github_read_only="1" ;;
    *) github_read_only="0" ;;
  esac
fi

github_toolsets="${GITHUB_TOOLSETS:-}"
if [ -z "${github_toolsets}" ]; then
  case "${profile}" in
    ci-readonly|review-governance) github_toolsets="repos,issues,pull_requests,actions,code_security" ;;
    triage-readonly) github_toolsets="repos,issues,pull_requests" ;;
    *) github_toolsets="all" ;;
  esac
fi

exec docker run -i --rm \
  -e GITHUB_PERSONAL_ACCESS_TOKEN="${token}" \
  -e GITHUB_READ_ONLY="${github_read_only}" \
  -e GITHUB_TOOLSETS="${github_toolsets}" \
  "${github_mcp_image}"
