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
  require_pattern \
    "AGENTS.md" \
    "scripts/check_branch_protection.sh" \
    "AGENTS.md does not reference branch protection validation." \
    "Add scripts/check_branch_protection.sh validation guidance to AGENTS.md."
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
  docs/agents/repo-index.json \
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

if [ -f scripts/check_provider_capabilities.py ]; then
  provider_python="python3"
  if [ -x backend/.venv/bin/python ]; then
    provider_python="backend/.venv/bin/python"
  fi
  set +e
  provider_check_output="$(${provider_python} scripts/check_provider_capabilities.py --provider all --strict --format json 2>&1)"
  provider_check_rc=$?
  set -e
  if [ "${provider_check_rc}" -ne 0 ]; then
    add_finding "Provider capability check failed: ${provider_check_output}"
    add_action "Fix provider runtime contracts and profile evidence consumed by scripts/check_provider_capabilities.py."
  fi
else
  add_finding "Missing required script: scripts/check_provider_capabilities.py"
  add_action "Create scripts/check_provider_capabilities.py and wire it into governance checks."
fi

if [ -f scripts/check_gemini_readiness.sh ]; then
  set +e
  gemini_check_output="$(./scripts/check_gemini_readiness.sh --mode static 2>&1)"
  gemini_check_rc=$?
  set -e
  if [ "${gemini_check_rc}" -ne 0 ]; then
    add_finding "Gemini static readiness check failed: ${gemini_check_output}"
    add_action "Fix .gemini/settings.json and required context/server entries consumed by scripts/check_gemini_readiness.sh --mode static."
  fi
else
  add_finding "Missing required script: scripts/check_gemini_readiness.sh"
  add_action "Create scripts/check_gemini_readiness.sh and wire it into governance checks."
fi

if [ -f scripts/check_mcp_profile_parity.py ]; then
  set +e
  mcp_parity_output="$(python3 scripts/check_mcp_profile_parity.py --strict --format json 2>&1)"
  mcp_parity_rc=$?
  set -e
  if [ "${mcp_parity_rc}" -ne 0 ]; then
    add_finding "MCP profile parity check failed: ${mcp_parity_output}"
    add_action "Align .mcp.json, .idx/mcp.json and .gemini/settings.json server/profile parity."
  fi
else
  add_finding "Missing required script: scripts/check_mcp_profile_parity.py"
  add_action "Create scripts/check_mcp_profile_parity.py and wire it into governance checks."
fi

if [ -f scripts/check_design_token_drift.sh ]; then
  set +e
  token_drift_output="$(./scripts/check_design_token_drift.sh 2>&1)"
  token_drift_rc=$?
  set -e
  if [ "${token_drift_rc}" -ne 0 ]; then
    add_finding "Design token drift check failed: ${token_drift_output}"
    add_action "Sync frontend/src/styles/tokens.json and frontend/src/styles/foundation.css."
  fi
else
  add_finding "Missing required script: scripts/check_design_token_drift.sh"
  add_action "Create scripts/check_design_token_drift.sh and wire it into governance checks."
fi

if [ -f scripts/generate_repo_index.py ]; then
  set +e
  repo_index_output="$(python3 scripts/generate_repo_index.py --check 2>&1)"
  repo_index_rc=$?
  set -e
  if [ "${repo_index_rc}" -ne 0 ]; then
    add_finding "Repository index drift check failed: ${repo_index_output}"
    add_action "Run python3 scripts/generate_repo_index.py --write and commit docs/agents/repo-index.json."
  fi
else
  add_finding "Missing required script: scripts/generate_repo_index.py"
  add_action "Create scripts/generate_repo_index.py for machine-readable navigation index generation."
fi

if [ -f scripts/check_entrypoint_coverage.py ]; then
  set +e
  entrypoint_output="$(python3 scripts/check_entrypoint_coverage.py 2>&1)"
  entrypoint_rc=$?
  set -e
  if [ "${entrypoint_rc}" -ne 0 ]; then
    add_finding "Entrypoint coverage check failed: ${entrypoint_output}"
    add_action "Repair docs/agents/entrypoints coverage so all active modules are mapped."
  fi
else
  add_finding "Missing required script: scripts/check_entrypoint_coverage.py"
  add_action "Create scripts/check_entrypoint_coverage.py and wire into governance checks."
fi

require_file "scripts/check_branch_protection.sh" "Create scripts/check_branch_protection.sh for autonomous auto-merge guardrails."

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
