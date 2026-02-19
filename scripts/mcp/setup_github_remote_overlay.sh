#!/usr/bin/env bash
set -euo pipefail

REMOTE_NAME="${REMOTE_NAME:-directstock-github-remote}"
REMOTE_URL="${REMOTE_URL:-https://api.githubcopilot.com/mcp/readonly}"

announce() {
  printf "\n==> %s\n" "$1"
}

setup_codex_overlay() {
  announce "Configuring Codex GitHub remote MCP overlay"
  if ! command -v codex >/dev/null 2>&1; then
    echo "codex CLI not found; skipping"
    return
  fi

  codex mcp remove "${REMOTE_NAME}" >/dev/null 2>&1 || true
  codex mcp add "${REMOTE_NAME}" --url "${REMOTE_URL}" >/dev/null
  echo "upserted codex server ${REMOTE_NAME} (${REMOTE_URL})"
}

setup_claude_overlay() {
  announce "Configuring Claude Code GitHub remote MCP overlay"
  if ! command -v claude >/dev/null 2>&1; then
    echo "claude CLI not found; skipping"
    return
  fi

  claude mcp remove -s user "${REMOTE_NAME}" >/dev/null 2>&1 || true
  claude mcp add --transport http -s user "${REMOTE_NAME}" "${REMOTE_URL}" >/dev/null
  echo "upserted claude server ${REMOTE_NAME} (${REMOTE_URL})"
}

setup_gemini_overlay() {
  announce "Configuring Gemini GitHub remote MCP overlay"
  if ! command -v gemini >/dev/null 2>&1; then
    echo "gemini CLI not found; skipping"
    return
  fi

  gemini mcp remove --scope user "${REMOTE_NAME}" >/dev/null 2>&1 || true
  gemini mcp add --transport http --scope user "${REMOTE_NAME}" "${REMOTE_URL}" >/dev/null
  echo "upserted gemini server ${REMOTE_NAME} (${REMOTE_URL})"
}

main() {
  setup_codex_overlay
  setup_claude_overlay
  setup_gemini_overlay
}

main "$@"
