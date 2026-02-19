#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

REPORT_FILE="${ROOT_DIR}/docs/validation/metrics/agent-governance-latest.md"
HISTORY_FILE="${ROOT_DIR}/docs/validation/metrics/agent-governance-history.md"
STATUS_FILE="${AGENT_GOVERNANCE_STATUS_FILE:-}"

mkdir -p "$(dirname "${REPORT_FILE}")"

timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

declare -a FINDINGS=()
declare -a ACTIONS=()

add_finding() {
  FINDINGS+=("$1")
}

add_action() {
  ACTIONS+=("$1")
}

require_file() {
  local path="$1"
  local remediation="$2"
  if [ ! -f "${path}" ]; then
    add_finding "Missing required file: ${path}."
    add_action "${remediation}"
    return 1
  fi
  return 0
}

require_pattern() {
  local path="$1"
  local pattern="$2"
  local message="$3"
  local remediation="$4"
  if ! grep -Fq "${pattern}" "${path}"; then
    add_finding "${message}"
    add_action "${remediation}"
  fi
}

if require_file "AGENTS.md" "Create AGENTS.md as canonical project policy file."; then
  require_pattern \
    "AGENTS.md" \
    "Autonomy mode: unrestricted_senior" \
    "AGENTS.md missing required autonomy declaration: Autonomy mode: unrestricted_senior." \
    "Set AGENTS.md to unrestricted_senior mode."
  require_pattern \
    "AGENTS.md" \
    "## High-Risk Execution Protocol" \
    "AGENTS.md missing High-Risk Execution Protocol section." \
    "Add a High-Risk Execution Protocol section to AGENTS.md."
  require_pattern \
    "AGENTS.md" \
    "docs/agents/decision-log.md" \
    "AGENTS.md does not reference docs/agents/decision-log.md." \
    "Reference docs/agents/decision-log.md in AGENTS.md."
fi

for scoped in backend/AGENTS.md frontend/AGENTS.md; do
  if require_file "${scoped}" "Create ${scoped} with scoped guidance."; then
    require_pattern \
      "${scoped}" \
      "Autonomy mode: unrestricted_senior" \
      "${scoped} missing required autonomy declaration." \
      "Add unrestricted_senior declaration to ${scoped}."
  fi
done

for adapter in CLAUDE.md CODEX.md GEMINI.md; do
  if require_file "${adapter}" "Create thin adapter ${adapter} pointing to AGENTS.md."; then
    lines="$(wc -l < "${adapter}" | tr -d ' ')"
    if [ "${lines}" -gt 120 ]; then
      add_finding "Adapter ${adapter} is not thin (${lines} lines)."
      add_action "Reduce ${adapter} to thin adapter content (<120 lines)."
    fi
    require_pattern \
      "${adapter}" \
      "unrestricted_senior" \
      "Adapter ${adapter} does not mention unrestricted_senior mode." \
      "Add unrestricted_senior guidance to ${adapter}."
  fi
done

if require_file "docs/agents/decision-log.md" "Create docs/agents/decision-log.md."; then
  for field in "action:" "rationale:" "impacted_files:" "risk_level:" "rollback_hint:" "verification:"; do
    if ! grep -Fq "${field}" docs/agents/decision-log.md; then
      add_finding "Decision log template missing required field: ${field}"
      add_action "Update docs/agents/decision-log.md to include ${field}."
    fi
  done
fi

for path in \
  docs/agents/policy.contract.yaml \
  docs/agents/policy.schema.json \
  docs/agents/providers/openai.md \
  docs/agents/providers/anthropic.md \
  docs/agents/providers/google.md \
  docs/agents/context-packs/backend.md \
  docs/agents/context-packs/frontend.md \
  docs/agents/context-packs/ops.md \
  docs/agents/context-packs/reports.md \
  docs/agents/context-packs/auth.md \
  docs/guides/ai-agent-setup.md \
  docs/guides/mcp-stack-strategy.md \
  docs/agents/handoff-protocol.md \
  docs/agents/incident-log.md \
  docs/agents/repo-map.md \
  docs/agents/change-playbooks.md \
  docs/agents/handoff.schema.json; do
  require_file "${path}" "Create ${path}."
done

if [ -f docs/agents/policy.contract.yaml ]; then
  require_pattern \
    "docs/agents/policy.contract.yaml" \
    "\"provider_matrix\"" \
    "Policy contract missing provider_matrix field." \
    "Update docs/agents/policy.contract.yaml to include provider_matrix."
fi

if [ -f scripts/agent_policy_lint.py ]; then
  policy_python="python3"
  if [ -x backend/.venv/bin/python ]; then
    policy_python="backend/.venv/bin/python"
  fi
  set +e
  policy_lint_output="$(${policy_python} scripts/agent_policy_lint.py --strict --provider all --format json 2>&1)"
  policy_lint_rc=$?
  set -e
  if [ "${policy_lint_rc}" -ne 0 ]; then
    add_finding "Policy lint failed: ${policy_lint_output}"
    add_action "Fix contract/provider parity issues reported by scripts/agent_policy_lint.py."
  fi
else
  add_finding "Missing required script: scripts/agent_policy_lint.py"
  add_action "Create scripts/agent_policy_lint.py and integrate provider parity linting."
fi

if [ -f docs/guides/ai-agent-setup.md ]; then
  require_pattern \
    "docs/guides/ai-agent-setup.md" \
    "unrestricted_senior" \
    "AI agent setup guide does not declare unrestricted_senior mode." \
    "Update docs/guides/ai-agent-setup.md with unrestricted_senior mode statement."
fi

if [ -f docs/guides/mcp-stack-strategy.md ]; then
  require_pattern \
    "docs/guides/mcp-stack-strategy.md" \
    "documentary/forensic defaults, not blocking controls" \
    "MCP strategy guide missing non-blocking guardrail wording for unrestricted_senior mode." \
    "Update docs/guides/mcp-stack-strategy.md with non-blocking guardrail wording."
fi

if [ ! -f "${HISTORY_FILE}" ]; then
  {
    echo "# Agent Governance Run History"
    echo
    echo "| Timestamp (UTC) | Debt | Findings | Recommended Actions |"
    echo "| --- | --- | ---: | ---: |"
  } > "${HISTORY_FILE}"
fi

debt_detected=0
if [ "${#FINDINGS[@]}" -gt 0 ]; then
  debt_detected=1
fi

printf '| %s | %s | %s | %s |\n' \
  "${timestamp}" \
  "${debt_detected}" \
  "${#FINDINGS[@]}" \
  "${#ACTIONS[@]}" >> "${HISTORY_FILE}"

{
  echo "# Agent Governance Snapshot"
  echo
  echo "Generated at: ${timestamp}"
  echo
  echo "## Summary"
  echo
  echo "- Debt detected: ${debt_detected}"
  echo "- Findings: ${#FINDINGS[@]}"
  echo "- Required autonomy mode: unrestricted_senior"
  echo
  echo "## Findings"
  echo
  if [ "${#FINDINGS[@]}" -eq 0 ]; then
    echo "- None"
  else
    for item in "${FINDINGS[@]}"; do
      echo "- ${item}"
    done
  fi
  echo
  echo "## Recommended Rule/Process Updates"
  echo
  if [ "${#ACTIONS[@]}" -eq 0 ]; then
    echo "- None"
  else
    for item in "${ACTIONS[@]}"; do
      echo "- ${item}"
    done
  fi
} > "${REPORT_FILE}"

if [ -n "${STATUS_FILE}" ]; then
  mkdir -p "$(dirname "${STATUS_FILE}")"
  printf 'debt=%s\n' "${debt_detected}" > "${STATUS_FILE}"
fi

if [ "${debt_detected}" -eq 1 ]; then
  echo "Agent governance debt detected. See ${REPORT_FILE}" >&2
  exit 2
fi

echo "Agent governance check passed."
