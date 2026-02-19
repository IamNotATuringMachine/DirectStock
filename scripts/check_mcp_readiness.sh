#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

REPORT_FILE="${ROOT_DIR}/docs/validation/metrics/mcp-readiness-latest.md"
mkdir -p "$(dirname "${REPORT_FILE}")"

timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
codex_home="${CODEX_HOME:-${HOME}/.codex}"
config_file="${codex_home}/config.toml"
repo_mcp_file="${ROOT_DIR}/.mcp.json"
mcp_profile_input="${MCP_PROFILE:-}"
require_postgres_readonly="${MCP_REQUIRE_POSTGRES_READONLY:-1}"
filesystem_version="${MCP_FILESYSTEM_VERSION:-2026.1.14}"
memory_version="${MCP_MEMORY_VERSION:-2026.1.26}"
playwright_version="${MCP_PLAYWRIGHT_VERSION:-0.0.68}"
git_version="${MCP_GIT_VERSION:-2026.1.14}"
github_image="${GITHUB_MCP_IMAGE:-ghcr.io/github/github-mcp-server:v0.31.0}"

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

contains_csv() {
  local csv="$1"
  local needle="$2"
  if [ -z "${csv}" ]; then
    return 1
  fi
  [[ ",${csv}," == *",${needle},"* ]]
}

load_repo_mcp_state() {
  if [ ! -f "${repo_mcp_file}" ]; then
    return 1
  fi

  python3 - "${repo_mcp_file}" "${mcp_profile_input}" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
requested_profile = sys.argv[2]
payload = json.loads(path.read_text(encoding="utf-8"))

profiles = payload.get("profiles", {})
defaults = payload.get("defaults", {})
mcp_servers = payload.get("mcpServers", {})

active_profile = requested_profile or defaults.get("profile", "")
profile_found = bool(active_profile and active_profile in profiles)
profile_servers = []
if profile_found:
    profile_servers = profiles.get(active_profile, {}).get("servers", []) or []

print(f"active_profile={active_profile}")
print(f"profile_found={'yes' if profile_found else 'no'}")
print(f"profile_servers={','.join(profile_servers)}")
print(f"all_servers={','.join(mcp_servers.keys())}")
PY
}

resolve_repo_configuration() {
  local mcp_state=""
  if ! mcp_state="$(load_repo_mcp_state 2>/dev/null)"; then
    return 1
  fi

  repo_active_profile=""
  repo_profile_found="no"
  repo_profile_servers=""
  repo_all_servers=""
  while IFS='=' read -r key value; do
    case "${key}" in
      active_profile) repo_active_profile="${value}" ;;
      profile_found) repo_profile_found="${value}" ;;
      profile_servers) repo_profile_servers="${value}" ;;
      all_servers) repo_all_servers="${value}" ;;
    esac
  done <<< "${mcp_state}"

  if [ -n "${repo_active_profile}" ] && [ "${repo_profile_found}" != "yes" ]; then
    echo "Requested MCP profile '${repo_active_profile}' does not exist in .mcp.json" >&2
    exit 2
  fi
}

server_enabled_repo() {
  local base="$1"
  local directstock_name="directstock-${base}"
  if [ "${repo_profile_found:-no}" = "yes" ]; then
    contains_csv "${repo_profile_servers}" "${directstock_name}" || contains_csv "${repo_profile_servers}" "${base}"
    return $?
  fi
  if [ -n "${repo_all_servers:-}" ]; then
    contains_csv "${repo_all_servers}" "${directstock_name}" || contains_csv "${repo_all_servers}" "${base}"
    return $?
  fi
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

extract_dsn_user() {
  local dsn="$1"
  python3 - "${dsn}" <<'PY'
import sys
from urllib.parse import urlparse

dsn = sys.argv[1]
try:
    user = urlparse(dsn).username or ""
except Exception:
    user = ""
print(user)
PY
}

validate_postgres_readonly() {
  local dsn="$1"

  if [ "${require_postgres_readonly}" != "1" ]; then
    echo "pass|readonly enforcement disabled via MCP_REQUIRE_POSTGRES_READONLY=0"
    return
  fi

  local dsn_user=""
  dsn_user="$(extract_dsn_user "${dsn}")"
  if [ -z "${dsn_user}" ]; then
    echo "fail|Could not parse PostgreSQL username from MCP DSN."
    return
  fi

  if [[ ! "${dsn_user}" =~ _ro$ ]]; then
    echo "fail|MCP DSN user '${dsn_user}' must end with '_ro' for read-only policy."
    return
  fi

  if ! command -v psql >/dev/null 2>&1; then
    echo "pass|readonly role suffix validated (${dsn_user}); deep probe skipped (psql not found)"
    return
  fi

  local elevated=""
  local write_all_data=""
  set +e
  elevated="$(psql "${dsn}" -tAqc "SELECT CASE WHEN rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls THEN 't' ELSE 'f' END FROM pg_roles WHERE rolname = current_user;" 2>/dev/null | tr -d '[:space:]')"
  local elevated_rc=$?
  write_all_data="$(psql "${dsn}" -tAqc "SELECT CASE WHEN pg_has_role(current_user, 'pg_write_all_data', 'member') THEN 't' ELSE 'f' END;" 2>/dev/null | tr -d '[:space:]')"
  local write_rc=$?
  set -e

  if [ "${elevated_rc}" -ne 0 ] || [ "${write_rc}" -ne 0 ]; then
    echo "fail|readonly role suffix validated (${dsn_user}), but privilege probe failed via psql."
    return
  fi

  if [ "${elevated}" = "t" ] || [ "${write_all_data}" = "t" ]; then
    echo "fail|readonly role '${dsn_user}' has elevated privileges (super/create/write-all-data)."
    return
  fi

  echo "pass|readonly role policy validated (${dsn_user})"
}

effective_profile() {
  if [ -n "${repo_active_profile:-}" ]; then
    echo "${repo_active_profile}"
    return
  fi
  if [ -n "${mcp_profile_input}" ]; then
    echo "${mcp_profile_input}"
    return
  fi
  echo "dev-autonomy"
}

effective_github_read_only() {
  if [ -n "${GITHUB_READ_ONLY:-}" ]; then
    echo "${GITHUB_READ_ONLY}"
    return
  fi
  case "$(effective_profile)" in
    ci-readonly|triage-readonly|review-governance) echo "1" ;;
    *) echo "0" ;;
  esac
}

effective_github_toolsets() {
  if [ -n "${GITHUB_TOOLSETS:-}" ]; then
    echo "${GITHUB_TOOLSETS}"
    return
  fi
  case "$(effective_profile)" in
    ci-readonly|review-governance) echo "repos,issues,pull_requests,actions,code_security" ;;
    triage-readonly) echo "repos,issues,pull_requests" ;;
    *) echo "all" ;;
  esac
}

repo_profile_found="no"
repo_active_profile=""
repo_profile_servers=""
repo_all_servers=""
config_source="codex-config"

if resolve_repo_configuration; then
  config_source=".mcp.json"
fi

cfg_filesystem="no"
cfg_postgres="no"
cfg_github="no"
cfg_playwright="no"
cfg_git="no"
cfg_memory="no"

if [ "${config_source}" = ".mcp.json" ]; then
  if server_enabled_repo "filesystem"; then cfg_filesystem="yes"; fi
  if server_enabled_repo "postgres"; then cfg_postgres="yes"; fi
  if server_enabled_repo "github"; then cfg_github="yes"; fi
  if server_enabled_repo "playwright"; then cfg_playwright="yes"; fi
  if server_enabled_repo "git"; then cfg_git="yes"; fi
  if server_enabled_repo "memory"; then cfg_memory="yes"; fi
else
  if has_any_heading "[mcp_servers.filesystem]" "[mcp_servers.directstock_filesystem]"; then cfg_filesystem="yes"; fi
  if has_any_heading "[mcp_servers.postgres]" "[mcp_servers.directstock_postgres]"; then cfg_postgres="yes"; fi
  if has_any_heading "[mcp_servers.github]" "[mcp_servers.directstock_github]"; then cfg_github="yes"; fi
  if has_any_heading "[mcp_servers.playwright]" "[mcp_servers.directstock_playwright]"; then cfg_playwright="yes"; fi
  if has_any_heading "[mcp_servers.git]" "[mcp_servers.directstock_git]"; then cfg_git="yes"; fi
  if has_any_heading "[mcp_servers.memory]" "[mcp_servers.directstock_memory]"; then cfg_memory="yes"; fi
fi

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
status_memory="blocked"
note_memory="server not configured"

if [ "${cfg_filesystem}" = "yes" ]; then
  if command -v npx >/dev/null 2>&1; then
    result="$(run_start_probe "npx -y \"@modelcontextprotocol/server-filesystem@${filesystem_version}\" \"${ROOT_DIR}\"")"
    status_filesystem="${result%%|*}"
    note_filesystem="${result#*|}"
  else
    note_filesystem="npx not found"
  fi
fi

if [ "${cfg_postgres}" = "yes" ]; then
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
    readonly_result="$(validate_postgres_readonly "${postgres_dsn}")"
    readonly_status="${readonly_result%%|*}"
    readonly_note="${readonly_result#*|}"
    if [ "${readonly_status}" != "pass" ]; then
      status_postgres="fail"
      note_postgres="${readonly_note}"
    else
      result="$(run_start_probe "MCP_POSTGRES_DSN=\"${postgres_dsn}\" MCP_REQUIRE_POSTGRES_READONLY=\"${require_postgres_readonly}\" \"${ROOT_DIR}/scripts/mcp/start_postgres_server.sh\"")"
      status_postgres="${result%%|*}"
      note_postgres="${result#*|}; ${readonly_note}"
    fi
  else
    note_postgres="MCP_POSTGRES_DSN not set and .env DB vars unavailable"
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
      github_read_only="$(effective_github_read_only)"
      github_toolsets="$(effective_github_toolsets)"
      result="$(run_start_probe "GITHUB_PERSONAL_ACCESS_TOKEN=\"${github_pat}\" GITHUB_MCP_IMAGE=\"${github_image}\" GITHUB_READ_ONLY=\"${github_read_only}\" GITHUB_TOOLSETS=\"${github_toolsets}\" MCP_PROFILE=\"$(effective_profile)\" \"${ROOT_DIR}/scripts/mcp/start_github_server.sh\"")"
      status_github="${result%%|*}"
      note_github="${result#*|}; image=${github_image}; read_only=${github_read_only}; toolsets=${github_toolsets}"
    else
      note_github="GITHUB_PERSONAL_ACCESS_TOKEN not set and gh auth token unavailable"
    fi
  else
    note_github="docker not found"
  fi
fi

if [ "${cfg_playwright}" = "yes" ]; then
  if command -v npx >/dev/null 2>&1; then
    result="$(run_probe "npx -y \"@playwright/mcp@${playwright_version}\" --help")"
    status_playwright="${result%%|*}"
    note_playwright="${result#*|}"
  else
    note_playwright="npx not found"
  fi
fi

if [ "${cfg_git}" = "yes" ]; then
  if command -v uvx >/dev/null 2>&1; then
    result="$(run_start_probe "uvx --from \"mcp-server-git==${git_version}\" mcp-server-git --repository \"${ROOT_DIR}\"")"
    status_git="${result%%|*}"
    note_git="${result#*|}"
  else
    note_git="uvx not found"
  fi
fi

if [ "${cfg_memory}" = "yes" ]; then
  if command -v npx >/dev/null 2>&1; then
    result="$(run_probe "npx -y \"@modelcontextprotocol/server-memory@${memory_version}\" --help")"
    status_memory="${result%%|*}"
    note_memory="${result#*|}"
  else
    note_memory="npx not found"
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
if [ "${overall}" != "failing" ]; then
  evaluate_server "${cfg_memory}" "${status_memory}"
fi

{
  echo "# MCP Readiness Snapshot"
  echo
  echo "Generated at: ${timestamp}"
  echo
  echo "## Summary"
  echo
  echo "- Overall status: ${overall}"
  echo "- Configuration source: ${config_source}"
  if [ "${config_source}" = ".mcp.json" ]; then
    echo "- Active profile: ${repo_active_profile:-<none>}"
  fi
  echo "- Config file: ${config_file}"
  echo "- Read-only DB enforcement: ${require_postgres_readonly}"
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
  echo "| memory | ${cfg_memory} | ${status_memory} | ${note_memory} |"
  echo
  echo "## Probe Semantics"
  echo
  echo "- The probe verifies startup and runtime prerequisites."
  echo "- It does not execute business-side effects."
  echo "- PostgreSQL readiness fails when MCP role is not a read-only role (user suffix '_ro'), unless explicitly disabled."
  echo "- GitHub probe surfaces effective MCP hardening (image pin, read-only posture, toolsets)."
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
