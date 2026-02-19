#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MCP_DIR="${ROOT_DIR}/scripts/mcp"
CODEX_CONFIG="${CODEX_HOME:-${HOME}/.codex}/config.toml"

FS_WRAPPER="${MCP_DIR}/start_filesystem_server.sh"
PG_WRAPPER="${MCP_DIR}/start_postgres_server.sh"
GH_WRAPPER="${MCP_DIR}/start_github_server.sh"
PW_WRAPPER="${MCP_DIR}/start_playwright_server.sh"

announce() {
  printf "\n==> %s\n" "$1"
}

has_toml_section() {
  local section="$1"
  [ -f "${CODEX_CONFIG}" ] && grep -Fq "[mcp_servers.${section}]" "${CODEX_CONFIG}"
}

append_codex_section() {
  local section="$1"
  local wrapper="$2"
  cat >> "${CODEX_CONFIG}" <<EOF

[mcp_servers.${section}]
command = "bash"
args = ["-lc", "exec ${wrapper}"]
EOF
}

setup_codex() {
  announce "Configuring Codex MCP servers"
  mkdir -p "$(dirname "${CODEX_CONFIG}")"
  touch "${CODEX_CONFIG}"

  if ! has_toml_section filesystem; then
    append_codex_section filesystem "${FS_WRAPPER}"
    echo "added codex filesystem server"
  else
    echo "codex filesystem server already configured"
  fi

  if ! has_toml_section postgres; then
    append_codex_section postgres "${PG_WRAPPER}"
    echo "added codex postgres server"
  else
    echo "codex postgres server already configured"
  fi

  if ! has_toml_section github; then
    append_codex_section github "${GH_WRAPPER}"
    echo "added codex github server"
  else
    echo "codex github server already configured"
  fi

  if ! has_toml_section playwright; then
    append_codex_section playwright "${PW_WRAPPER}"
    echo "added codex playwright server"
  else
    echo "codex playwright server already configured"
  fi
}

setup_claude() {
  announce "Configuring Claude Code MCP servers"
  if ! command -v claude >/dev/null 2>&1; then
    echo "claude CLI not found; skipping"
    return
  fi

  local scope="project"
  local names=("directstock-filesystem" "directstock-postgres" "directstock-github" "directstock-playwright")
  local wrappers=("${FS_WRAPPER}" "${PG_WRAPPER}" "${GH_WRAPPER}" "${PW_WRAPPER}")
  local i

  for i in "${!names[@]}"; do
    claude mcp remove -s "${scope}" "${names[$i]}" >/dev/null 2>&1 || true
    claude mcp add -s "${scope}" "${names[$i]}" -- "${wrappers[$i]}" >/dev/null
    echo "upserted claude server ${names[$i]}"
  done

  local list_output=""
  list_output="$(claude mcp list 2>&1 || true)"
  for name in "${names[@]}"; do
    if ! printf '%s\n' "${list_output}" | rg -Fq "${name}"; then
      echo "claude MCP validation failed: missing ${name}" >&2
      exit 1
    fi
  done
  echo "claude project MCP servers configured"
}

setup_gemini() {
  announce "Configuring Gemini CLI MCP servers"
  if ! command -v gemini >/dev/null 2>&1; then
    echo "gemini CLI not found; skipping"
    return
  fi

  local scope="project"
  local names=("directstock-filesystem" "directstock-postgres" "directstock-github" "directstock-playwright")
  local wrappers=("${FS_WRAPPER}" "${PG_WRAPPER}" "${GH_WRAPPER}" "${PW_WRAPPER}")
  local i

  for i in "${!names[@]}"; do
    gemini mcp remove -s "${scope}" "${names[$i]}" >/dev/null 2>&1 || true
    gemini mcp add -s "${scope}" "${names[$i]}" "${wrappers[$i]}" >/dev/null
    echo "upserted gemini server ${names[$i]}"
  done

  local list_output=""
  list_output="$(gemini mcp list 2>&1 || true)"
  for name in "${names[@]}"; do
    if ! printf '%s\n' "${list_output}" | rg -Fq "${name}"; then
      echo "gemini MCP validation failed: missing ${name}" >&2
      exit 1
    fi
  done
  echo "gemini project MCP servers configured"
}

main() {
  if ! command -v rg >/dev/null 2>&1; then
    echo "rg is required by setup script." >&2
    exit 1
  fi

  setup_codex
  setup_claude
  setup_gemini
}

main "$@"
