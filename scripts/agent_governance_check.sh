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

if [ ! -f "AGENTS.md" ]; then
  add_finding "Missing root AGENTS.md."
  add_action "Create AGENTS.md as canonical project policy file."
fi

if [ -f "AGENTS.md" ]; then
  for heading in "## Autonomy Decision Matrix" "## Escalation Triggers" "## Handoff Minimum" "## Failure Policy" "## LLM Context Architecture Targets"; do
    if ! grep -Fq "${heading}" AGENTS.md; then
      add_finding "AGENTS.md missing required section: ${heading}."
      add_action "Add missing section ${heading} to AGENTS.md."
    fi
  done
fi

for adapter in CLAUDE.md CODEX.md GEMINI.md; do
  if [ ! -f "${adapter}" ]; then
    add_finding "Missing adapter file: ${adapter}."
    add_action "Create thin adapter ${adapter} pointing to AGENTS.md."
    continue
  fi
  lines="$(wc -l < "${adapter}" | tr -d ' ')"
  if [ "${lines}" -gt 120 ]; then
    add_finding "Adapter ${adapter} is not thin (${lines} lines)."
    add_action "Reduce ${adapter} to thin adapter content (<120 lines)."
  fi
done

for path in \
  docs/agents/handoff-protocol.md \
  docs/agents/incident-log.md \
  docs/agents/repo-map.md \
  docs/agents/change-playbooks.md \
  docs/agents/handoff.schema.json \
  docs/agents/entrypoints/operations.md \
  docs/agents/entrypoints/reports.md \
  docs/agents/entrypoints/returns.md \
  docs/agents/entrypoints/shipping.md \
  docs/agents/entrypoints/product-form.md; do
  if [ ! -f "${path}" ]; then
    add_finding "Missing LLM context artifact: ${path}."
    add_action "Create ${path}."
  fi
done

if ! grep -Eq 'limit=500|limit=350' scripts/check_file_size_limits.sh; then
  add_finding "Chunking policy not aligned with LLM targets (<500 production, <350 page/router)."
  add_action "Update scripts/check_file_size_limits.sh to enforce 500/350 targets."
fi

if [ -f docs/validation/metrics/golden-tasks-latest.md ]; then
  first_pass="$(grep -E 'First-pass success:' docs/validation/metrics/golden-tasks-latest.md | sed -E 's/.*First-pass success: ([0-9]+\.[0-9]+)%.*/\1/' | head -n1 || true)"
  failed_tasks="$(grep -E '^- Failed:' docs/validation/metrics/golden-tasks-latest.md | sed -E 's/^- Failed: ([0-9]+).*/\1/' | head -n1 || true)"

  if [ -n "${first_pass}" ]; then
    if awk "BEGIN {exit !(${first_pass} < 90.0)}"; then
      add_finding "Golden task first-pass success below 90% (${first_pass}%)."
      add_action "Stabilize failing golden tasks and rerun ./scripts/run_golden_tasks.sh."
    fi
  else
    add_finding "Could not parse first-pass success from golden task report."
    add_action "Repair docs/validation/metrics/golden-tasks-latest.md format."
  fi

  if [ -n "${failed_tasks}" ] && [ "${failed_tasks}" -gt 0 ]; then
    add_finding "Golden tasks currently have ${failed_tasks} failure(s)."
    add_action "Investigate docs/validation/metrics/golden-task-logs/* and fix root causes."
  fi
else
  add_finding "Missing golden task report: docs/validation/metrics/golden-tasks-latest.md."
  add_action "Run ./scripts/run_golden_tasks.sh and commit updated metrics."
fi

if [ -f docs/validation/metrics/test-flakiness-latest.md ]; then
  flake_rate="$(grep -E '^\| Flake rate \|' docs/validation/metrics/test-flakiness-latest.md | sed -E 's/^\| Flake rate \| ([0-9]+\.[0-9]+)% \|.*$/\1/' | head -n1 || true)"
  if [ -n "${flake_rate}" ] && awk "BEGIN {exit !(${flake_rate} >= 1.0)}"; then
    add_finding "E2E flake rate is ${flake_rate}% (target < 1.0%)."
    add_action "Run flakiness loop and quarantine unstable tests before merge."
  fi
fi

debt_detected=0
if [ "${#FINDINGS[@]}" -gt 0 ]; then
  debt_detected=1
fi

if [ ! -f "${HISTORY_FILE}" ]; then
  {
    echo "# Agent Governance Run History"
    echo
    echo "| Timestamp (UTC) | Debt | Findings | Recommended Actions |"
    echo "| --- | --- | ---: | ---: |"
  } > "${HISTORY_FILE}"
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
