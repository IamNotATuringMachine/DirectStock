#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

REPORT_FILE="${ROOT_DIR}/docs/validation/metrics/mcp-readiness-latest.md"
mkdir -p "$(dirname "${REPORT_FILE}")"

timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
codex_home="${CODEX_HOME:-${HOME}/.codex}"
config_file="${codex_home}/config.toml"

has_heading() {
  local heading="$1"
  if [ ! -f "${config_file}" ]; then
    return 1
  fi
  grep -Fq "${heading}" "${config_file}"
}

has_any_heading() {
  for heading in "$@"; do
    if has_heading "${heading}"; then
      return 0
    fi
  done
  return 1
}

run_probe() {
  local cmd="$1"
  local output
  set +e
  output="$(eval "${cmd}" 2>&1)"
  local rc=$?
  set -e
  if [ "${rc}" -eq 0 ]; then
    echo "pass|startup probe ok"
  else
    output="$(echo "${output}" | tr '\n' ' ' | sed -E 's/[[:space:]]+/ /g' | cut -c1-180)"
    echo "fail|${output}"
  fi
}

run_start_probe() {
  local cmd="$1"
  local output_file
  local output
  local rc=0
  output_file="$(mktemp)"

  set +e
  bash -lc "${cmd}" >"${output_file}" 2>&1 &
  local pid=$!
  sleep 2
  if kill -0 "${pid}" >/dev/null 2>&1; then
    kill "${pid}" >/dev/null 2>&1 || true
    wait "${pid}" >/dev/null 2>&1 || true
    rc=0
  else
    wait "${pid}"
    rc=$?
  fi
  set -e

  if [ "${rc}" -eq 0 ]; then
    rm -f "${output_file}"
    echo "pass|startup probe ok"
    return
  fi

  output="$(tr '\n' ' ' < "${output_file}" | sed -E 's/[[:space:]]+/ /g' | cut -c1-180)"
  rm -f "${output_file}"
  echo "fail|${output}"
}

cfg_filesystem="no"
cfg_postgres="no"
cfg_github="no"
cfg_playwright="no"
cfg_git="no"

if has_any_heading "[mcp_servers.filesystem]" "[mcp_servers.directstock_filesystem]"; then cfg_filesystem="yes"; fi
if has_any_heading "[mcp_servers.postgres]" "[mcp_servers.directstock_postgres]"; then cfg_postgres="yes"; fi
if has_any_heading "[mcp_servers.github]" "[mcp_servers.directstock_github]"; then cfg_github="yes"; fi
if has_any_heading "[mcp_servers.playwright]" "[mcp_servers.directstock_playwright]"; then cfg_playwright="yes"; fi
if has_any_heading "[mcp_servers.git]" "[mcp_servers.directstock_git]"; then cfg_git="yes"; fi

status_filesystem="blocked"
note_filesystem="server not configured"
status_postgres="blocked"
note_postgres="server not configured"
status_github="blocked"
note_github="server not configured"
status_playwright="blocked"
note_playwright="server not configured"
status_git="blocked"
note_git="server not configured"

if [ "${cfg_filesystem}" = "yes" ]; then
  if command -v npx >/dev/null 2>&1; then
    result="$(run_start_probe "npx -y @modelcontextprotocol/server-filesystem \"${ROOT_DIR}\"")"
    status_filesystem="${result%%|*}"
    note_filesystem="${result#*|}"
  else
    note_filesystem="npx not found"
  fi
fi

if [ "${cfg_postgres}" = "yes" ]; then
  if command -v npx >/dev/null 2>&1; then
    postgres_dsn="${MCP_POSTGRES_DSN:-}"
    if [ -z "${postgres_dsn}" ] && [ -f "${ROOT_DIR}/.env" ]; then
      set -a
      # shellcheck disable=SC1091
      source "${ROOT_DIR}/.env"
      set +a
      if [ -n "${POSTGRES_USER:-}" ] && [ -n "${POSTGRES_PASSWORD:-}" ] && [ -n "${POSTGRES_DB:-}" ]; then
        postgres_dsn="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}"
      fi
    fi
    if [ -n "${postgres_dsn}" ]; then
      result="$(run_start_probe "npx -y @modelcontextprotocol/server-postgres \"${postgres_dsn}\"")"
      status_postgres="${result%%|*}"
      note_postgres="${result#*|}"
    else
      note_postgres="MCP_POSTGRES_DSN not set and .env DB vars unavailable"
    fi
  else
    note_postgres="npx not found"
  fi
fi

if [ "${cfg_github}" = "yes" ]; then
  if command -v docker >/dev/null 2>&1; then
    github_pat="${GITHUB_PERSONAL_ACCESS_TOKEN:-}"
    if [ -z "${github_pat}" ] && command -v gh >/dev/null 2>&1; then
      set +e
      github_pat="$(gh auth token 2>/dev/null)"
      set -e
    fi
    if [ -n "${github_pat}" ]; then
      result="$(run_start_probe "docker run --rm -e GITHUB_PERSONAL_ACCESS_TOKEN=\"${github_pat}\" ghcr.io/github/github-mcp-server")"
      status_github="${result%%|*}"
      note_github="${result#*|}"
    else
      note_github="GITHUB_PERSONAL_ACCESS_TOKEN not set and gh auth token unavailable"
    fi
  else
    note_github="docker not found"
  fi
fi

if [ "${cfg_playwright}" = "yes" ]; then
  if command -v npx >/dev/null 2>&1; then
    result="$(run_probe "npx -y @playwright/mcp@latest --help")"
    status_playwright="${result%%|*}"
    note_playwright="${result#*|}"
  else
    note_playwright="npx not found"
  fi
fi

if [ "${cfg_git}" = "yes" ]; then
  if command -v uvx >/dev/null 2>&1; then
    result="$(run_start_probe "uvx mcp-server-git --repository \"${ROOT_DIR}\"")"
    status_git="${result%%|*}"
    note_git="${result#*|}"
  else
    note_git="uvx not found"
  fi
fi

overall="ready"
evaluate_server() {
  local configured="$1"
  local probe_status="$2"
  if [ "${configured}" = "yes" ]; then
    if [ "${probe_status}" = "fail" ]; then
      overall="failing"
      return
    fi
    if [ "${probe_status}" = "blocked" ] && [ "${overall}" = "ready" ]; then
      overall="blocked"
      return
    fi
  else
    if [ "${overall}" = "ready" ]; then
      overall="blocked"
    fi
  fi
}

evaluate_server "${cfg_filesystem}" "${status_filesystem}"
if [ "${overall}" != "failing" ]; then
  evaluate_server "${cfg_postgres}" "${status_postgres}"
fi
if [ "${overall}" != "failing" ]; then
  evaluate_server "${cfg_github}" "${status_github}"
fi
if [ "${overall}" != "failing" ]; then
  evaluate_server "${cfg_playwright}" "${status_playwright}"
fi
if [ "${overall}" != "failing" ]; then
  evaluate_server "${cfg_git}" "${status_git}"
fi

{
  echo "# MCP Readiness Snapshot"
  echo
  echo "Generated at: ${timestamp}"
  echo
  echo "## Summary"
  echo
  echo "- Overall status: ${overall}"
  echo "- Config file: ${config_file}"
  echo
  echo "## Server Checks"
  echo
  echo "| Server | Configured | Probe Status | Notes |"
  echo "| --- | --- | --- | --- |"
  echo "| filesystem | ${cfg_filesystem} | ${status_filesystem} | ${note_filesystem} |"
  echo "| postgres | ${cfg_postgres} | ${status_postgres} | ${note_postgres} |"
  echo "| github | ${cfg_github} | ${status_github} | ${note_github} |"
  echo "| playwright | ${cfg_playwright} | ${status_playwright} | ${note_playwright} |"
  echo "| git | ${cfg_git} | ${status_git} | ${note_git} |"
  echo
  echo "## Probe Semantics"
  echo
  echo "- The probe verifies startup (--help) and runtime prerequisites."
  echo "- It does not execute business-side effects."
} > "${REPORT_FILE}"

if [ "${overall}" = "ready" ]; then
  echo "MCP readiness check passed."
  exit 0
fi

if [ "${overall}" = "blocked" ] && [ "${MCP_PROBE_ALLOW_BLOCKED:-0}" = "1" ]; then
  echo "MCP readiness check blocked by missing local prerequisites/secrets."
  exit 0
fi

echo "MCP readiness check not ready (status=${overall}). See ${REPORT_FILE}" >&2
exit 2
