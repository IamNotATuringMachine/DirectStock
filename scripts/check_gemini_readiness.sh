#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SETTINGS_FILE="${ROOT_DIR}/.gemini/settings.json"
MODE="runtime"
ENFORCE_ALLOWLIST="${GEMINI_READINESS_ENFORCE_ALLOWLIST:-0}"

required_servers=(
  "directstock-filesystem"
  "directstock-postgres"
  "directstock-github"
  "directstock-playwright"
  "directstock-git"
  "directstock-memory"
)

usage() {
  cat <<'EOF'
Usage: ./scripts/check_gemini_readiness.sh [--mode runtime|static] [--enforce-allowlist]

Modes:
  runtime (default): validates settings plus gemini mcp connectivity
  static           : validates settings structure and required entries only

Options:
  --enforce-allowlist  In runtime mode, fail if connected Gemini MCP servers are not exactly the DirectStock allowlist.
EOF
}

fatal() {
  echo "$1" >&2
  exit 2
}

not_ready() {
  echo "$1" >&2
  exit 1
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --mode)
      [ "$#" -ge 2 ] || fatal "missing value for --mode"
      MODE="$2"
      shift 2
      ;;
    --mode=*)
      MODE="${1#*=}"
      shift
      ;;
    --enforce-allowlist)
      ENFORCE_ALLOWLIST="1"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fatal "unknown argument: $1"
      ;;
  esac
done

case "${MODE}" in
  runtime|static)
    ;;
  *)
    fatal "invalid mode '${MODE}'; expected runtime or static"
    ;;
esac

if [ ! -f "${SETTINGS_FILE}" ]; then
  not_ready "missing settings file: ${SETTINGS_FILE}"
fi

python3 - "${SETTINGS_FILE}" <<'PY'
import json
import sys
from pathlib import Path

settings_path = Path(sys.argv[1])
required_servers = [
    "directstock-filesystem",
    "directstock-postgres",
    "directstock-github",
    "directstock-playwright",
    "directstock-git",
    "directstock-memory",
]
required_context = {"AGENTS.md", "GEMINI.md"}

try:
    payload = json.loads(settings_path.read_text(encoding="utf-8"))
except json.JSONDecodeError as exc:
    print(f"invalid json in {settings_path}: {exc}", file=sys.stderr)
    raise SystemExit(2)
except Exception as exc:
    print(f"failed to read {settings_path}: {exc}", file=sys.stderr)
    raise SystemExit(2)

mcp_servers = payload.get("mcpServers")
if not isinstance(mcp_servers, dict):
    print("settings.mcpServers missing or invalid", file=sys.stderr)
    raise SystemExit(1)

missing_servers = [name for name in required_servers if name not in mcp_servers]
if missing_servers:
    print(f"missing mcp servers in settings: {', '.join(missing_servers)}", file=sys.stderr)
    raise SystemExit(1)

for name in required_servers:
    entry = mcp_servers.get(name)
    if not isinstance(entry, dict):
        print(f"settings.mcpServers.{name} must be an object", file=sys.stderr)
        raise SystemExit(1)
    command = entry.get("command")
    args = entry.get("args")
    if not isinstance(command, str) or not command:
        print(f"settings.mcpServers.{name}.command missing or invalid", file=sys.stderr)
        raise SystemExit(1)
    if not isinstance(args, list):
        print(f"settings.mcpServers.{name}.args missing or invalid", file=sys.stderr)
        raise SystemExit(1)

context = payload.get("context", {})
file_names = context.get("fileName", [])
if isinstance(file_names, str):
    file_names = [file_names]
if not isinstance(file_names, list):
    print("settings.context.fileName missing or invalid", file=sys.stderr)
    raise SystemExit(1)

missing_context = [name for name in sorted(required_context) if name not in file_names]
if missing_context:
    print(f"missing required context files in settings: {', '.join(missing_context)}", file=sys.stderr)
    raise SystemExit(1)

if "frontend/AGENTS.md" not in file_names:
    print("warning: frontend/AGENTS.md not included in context.fileName", file=sys.stderr)
PY
py_status=$?
if [ "${py_status}" -eq 2 ]; then
  exit 2
fi
if [ "${py_status}" -ne 0 ]; then
  exit 1
fi

if [ "${MODE}" = "static" ]; then
  echo "ready"
  exit 0
fi

if ! command -v gemini >/dev/null 2>&1; then
  fatal "gemini CLI not found"
fi

gemini_version="$(gemini --version 2>/dev/null || true)"
if [ -z "${gemini_version}" ]; then
  fatal "gemini CLI version lookup failed"
fi

project_mcp="${ROOT_DIR}/.mcp.json"
project_mcp_backup=""
cleanup() {
  if [ -n "${project_mcp_backup}" ] && [ -f "${project_mcp_backup}" ]; then
    cp "${project_mcp_backup}" "${project_mcp}"
    rm -f "${project_mcp_backup}"
  fi
}
trap cleanup EXIT

if [ -f "${project_mcp}" ]; then
  project_mcp_backup="$(mktemp)"
  cp "${project_mcp}" "${project_mcp_backup}"
fi

set +e
list_output="$(gemini mcp list 2>&1)"
list_rc=$?
set -e

if [ "${list_rc}" -ne 0 ]; then
  fatal "gemini mcp list failed: ${list_output}"
fi

list_output_clean="$(printf '%s\n' "${list_output}" | sed -E $'s/\x1B\\[[0-9;]*[A-Za-z]//g')"

missing_list_entries=()
disconnected_entries=()

for name in "${required_servers[@]}"; do
  if ! printf '%s\n' "${list_output_clean}" | grep -Fq "${name}:"; then
    missing_list_entries+=("${name}")
    continue
  fi
  if ! printf '%s\n' "${list_output_clean}" | grep -Eq "${name}:.*Connected"; then
    disconnected_entries+=("${name}")
  fi
done

echo "gemini version: ${gemini_version}"

if [ "${#missing_list_entries[@]}" -gt 0 ]; then
  not_ready "missing servers in 'gemini mcp list': ${missing_list_entries[*]}"
fi

if [ "${#disconnected_entries[@]}" -gt 0 ]; then
  not_ready "servers not connected in 'gemini mcp list': ${disconnected_entries[*]}"
fi

if [ "${ENFORCE_ALLOWLIST}" = "1" ]; then
  required_servers_csv="$(IFS=,; echo "${required_servers[*]}")"
  allowlist_report="$(
    REQUIRED_SERVERS_CSV="${required_servers_csv}" LIST_OUTPUT_CLEAN="${list_output_clean}" python3 - <<'PY'
import os
import re

required = set(filter(None, os.environ.get("REQUIRED_SERVERS_CSV", "").split(",")))
list_output_clean = os.environ.get("LIST_OUTPUT_CLEAN", "")
connected: list[str] = []

for line in list_output_clean.splitlines():
    match = re.search(r"([A-Za-z0-9._-]+):.* - Connected\b", line)
    if match:
        connected.append(match.group(1))

connected_set = set(connected)
missing = sorted(required - connected_set)
extra = sorted(connected_set - required)

if missing or extra:
    print("invalid")
    if missing:
        print("missing=" + ",".join(missing))
    if extra:
        print("extra=" + ",".join(extra))
else:
    print("valid")
PY
  )"

  if [ "${allowlist_report%%$'\n'*}" != "valid" ]; then
    not_ready "gemini runtime allowlist mismatch (${allowlist_report//$'\n'/; })"
  fi
fi

echo "ready"
