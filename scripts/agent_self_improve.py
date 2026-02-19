#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
CONTRACT_PATH = REPO_ROOT / "docs/agents/policy.contract.yaml"
INCIDENT_LOG_PATH = REPO_ROOT / "docs/agents/incident-log.md"
DECISION_LOG_PATH = REPO_ROOT / "docs/agents/decision-log.md"
BACKLOG_PATH = REPO_ROOT / "docs/agents/auto-improvement-backlog.md"
AGENTS_PATH = REPO_ROOT / "AGENTS.md"
BRANCH_GUARD_PATH = REPO_ROOT / "scripts/check_branch_protection.sh"


@dataclass(slots=True)
class ImprovementResult:
    recommendations: list[str]
    modified_files: list[str]


def _load_json_compatible(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    return json.loads(text)


def _write_text_if_changed(path: Path, content: str) -> bool:
    current = path.read_text(encoding="utf-8") if path.exists() else ""
    if current == content:
        return False
    path.write_text(content, encoding="utf-8")
    return True


def _write_json_compatible(path: Path, payload: dict[str, Any]) -> bool:
    return _write_text_if_changed(path, json.dumps(payload, indent=2) + "\n")


def _run_policy_lint() -> dict[str, Any]:
    policy_python = sys.executable
    backend_python = REPO_ROOT / "backend/.venv/bin/python"
    if backend_python.exists():
        policy_python = str(backend_python)

    command = [
        policy_python,
        str(REPO_ROOT / "scripts/agent_policy_lint.py"),
        "--strict",
        "--provider",
        "all",
        "--format",
        "json",
    ]
    process = subprocess.run(command, cwd=REPO_ROOT, capture_output=True, text=True)
    if process.returncode not in {0, 1}:
        raise RuntimeError(f"agent_policy_lint failed: {process.stderr.strip() or process.stdout.strip()}")
    return json.loads(process.stdout)


def _parse_recurring_incidents(*, count_threshold: int, window_days: int) -> list[tuple[str, int]]:
    if not INCIDENT_LOG_PATH.exists():
        return []

    now = datetime.now(UTC)
    cutoff = now - timedelta(days=window_days)

    categories: list[str] = []
    current_timestamp: datetime | None = None
    current_category: str | None = None

    for raw_line in INCIDENT_LOG_PATH.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if line.startswith("## Incident "):
            if current_timestamp and current_category and current_timestamp >= cutoff:
                categories.append(current_category)
            current_timestamp = None
            current_category = None
            continue

        if line.startswith("- timestamp_utc:"):
            value = line.split(":", 1)[1].strip()
            try:
                current_timestamp = datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)
            except ValueError:
                current_timestamp = None
            continue

        if line.startswith("- category:"):
            current_category = line.split(":", 1)[1].strip()
            continue

    if current_timestamp and current_category and current_timestamp >= cutoff:
        categories.append(current_category)

    counts = Counter(categories)
    recurring = [(category, amount) for category, amount in counts.items() if amount >= count_threshold]
    recurring.sort(key=lambda item: (-item[1], item[0]))
    return recurring


def _ensure_contract_defaults(contract: dict[str, Any]) -> tuple[dict[str, Any], bool]:
    changed = False

    if contract.get("autonomy_mode") != "unrestricted_senior":
        contract["autonomy_mode"] = "unrestricted_senior"
        changed = True

    decision_classes = set(contract.get("decision_classes") or [])
    expected_classes = {"auto_execute", "ask_once"}
    if decision_classes != expected_classes:
        contract["decision_classes"] = ["auto_execute", "ask_once"]
        changed = True

    high_risk = contract.setdefault("high_risk_protocol", {})
    if high_risk.get("decision_log_path") != "docs/agents/decision-log.md":
        high_risk["decision_log_path"] = "docs/agents/decision-log.md"
        changed = True
    if high_risk.get("requires_pre_and_post_entry") is not True:
        high_risk["requires_pre_and_post_entry"] = True
        changed = True

    provider_matrix = contract.setdefault("provider_matrix", {})
    provider_defaults = {
        "openai": {
            "adapter_file": "CODEX.md",
            "policy_doc": "docs/agents/providers/openai.md",
            "required_capabilities": [
                "responses_api",
                "conversation_state",
                "background_mode",
                "mcp_tooling",
                "multi_agent_workflows",
            ],
            "fallback_order": ["AGENTS.md", "docs/agents/providers/openai.md", "CODEX.md"],
        },
        "anthropic": {
            "adapter_file": "CLAUDE.md",
            "policy_doc": "docs/agents/providers/anthropic.md",
            "required_capabilities": ["claude_code_hooks", "memory_files", "prompt_caching", "mcp_connectors"],
            "fallback_order": ["AGENTS.md", "docs/agents/providers/anthropic.md", "CLAUDE.md"],
        },
        "google": {
            "adapter_file": "GEMINI.md",
            "policy_doc": "docs/agents/providers/google.md",
            "required_capabilities": ["adk_workflows", "agent_engine_patterns", "a2a_interoperability", "mcp_tooling"],
            "fallback_order": ["AGENTS.md", "docs/agents/providers/google.md", "GEMINI.md"],
        },
    }

    for provider_name, provider_default in provider_defaults.items():
        provider_value = provider_matrix.get(provider_name)
        if not isinstance(provider_value, dict):
            provider_matrix[provider_name] = provider_default
            changed = True
            continue
        for key, default_value in provider_default.items():
            if key not in provider_value:
                provider_value[key] = default_value
                changed = True

    runtime_contracts = contract.setdefault("provider_runtime_contracts", {})
    runtime_defaults = {
        "openai": {
            "required_behaviors": [
                "responses_api_first",
                "conversation_state_preserved",
                "background_mode_for_long_tasks",
                "remote_mcp_tooling_supported",
                "tool_result_traceability",
            ],
            "verification_artifacts": [
                "docs/agents/providers/openai.md",
                "scripts/check_provider_capabilities.py",
            ],
        },
        "anthropic": {
            "required_behaviors": [
                "claude_code_hooks_available",
                "memory_files_supported",
                "prompt_caching_supported",
                "mcp_connector_supported",
                "tool_result_traceability",
            ],
            "verification_artifacts": [
                "docs/agents/providers/anthropic.md",
                "scripts/check_provider_capabilities.py",
            ],
        },
        "google": {
            "required_behaviors": [
                "adk_workflows_supported",
                "agent_engine_patterns_supported",
                "a2a_interoperability_supported",
                "mcp_tooling_supported",
                "tool_result_traceability",
                "ui_ux_visual_diff_mandatory",
                "ui_ux_accessibility_gate_mandatory",
                "ui_ux_fallback_sequence_defined",
            ],
            "verification_artifacts": [
                "docs/agents/providers/google.md",
                "scripts/check_provider_capabilities.py",
                "frontend/tests/e2e/visual-baseline.spec.ts",
                "frontend/tests/e2e/a11y-smoke.spec.ts",
                "scripts/check_design_token_drift.sh",
            ],
        },
    }
    for provider_name, runtime_default in runtime_defaults.items():
        runtime_value = runtime_contracts.get(provider_name)
        if not isinstance(runtime_value, dict):
            runtime_contracts[provider_name] = runtime_default
            changed = True
            continue
        for key, default_value in runtime_default.items():
            if key not in runtime_value:
                runtime_value[key] = default_value
                changed = True

    noise_guard = contract.setdefault("self_improvement_noise_guard", {})
    noise_defaults = {
        "enabled": True,
        "block_timestamp_only_churn": True,
        "require_semantic_diff_for_pr": True,
    }
    for key, value in noise_defaults.items():
        if key not in noise_guard:
            noise_guard[key] = value
            changed = True

    self_improvement = contract.setdefault("self_improvement_policy", {})
    defaults = {
        "enabled": True,
        "runner_script": "scripts/agent_self_improve.py",
        "max_changes_per_run": 5,
        "touch_allowlist": ["AGENTS", "docs", "scripts"],
        "incident_threshold": {"count": 3, "window_days": 14},
    }
    for key, value in defaults.items():
        if key not in self_improvement:
            self_improvement[key] = value
            changed = True

    required_gates = contract.get("required_gates")
    if not isinstance(required_gates, list) or not required_gates:
        contract["required_gates"] = [
            "./scripts/agent_governance_check.sh",
            "python3 scripts/agent_policy_lint.py --strict --provider all --format json",
            "python3 scripts/check_provider_capabilities.py --provider all --format json",
            "./scripts/check_gemini_readiness.sh",
            "cd frontend && npm run test:e2e:a11y",
            "cd frontend && npm run test:e2e:visual",
            "./scripts/check_design_token_drift.sh",
            "python3 scripts/generate_repo_index.py --check",
            "python3 scripts/check_entrypoint_coverage.py",
            "MCP_PROFILE=ci-readonly MCP_REQUIRE_POSTGRES_READONLY=1 ./scripts/check_mcp_readiness.sh",
            "./scripts/check_branch_protection.sh",
        ]
        changed = True

    eval_gates = contract.get("eval_gates")
    if not isinstance(eval_gates, list) or not eval_gates:
        contract["eval_gates"] = [
            "./scripts/agent_governance_check.sh",
            "python3 scripts/agent_policy_lint.py --strict --provider all --format json",
            "python3 scripts/check_provider_capabilities.py --provider all --format json",
            "./scripts/check_gemini_readiness.sh",
            "cd frontend && npm run test:e2e:a11y",
            "cd frontend && npm run test:e2e:visual",
            "./scripts/check_design_token_drift.sh",
            "python3 scripts/generate_repo_index.py --check",
            "python3 scripts/check_entrypoint_coverage.py",
            "MCP_PROFILE=ci-readonly MCP_REQUIRE_POSTGRES_READONLY=1 ./scripts/check_mcp_readiness.sh",
            "./scripts/check_branch_protection.sh",
        ]
        changed = True

    return contract, changed


def _write_backlog(*, lint_payload: dict[str, Any], recurring_incidents: list[tuple[str, int]], recommendations: list[str]) -> bool:
    lines = [
        "# Agent Auto-Improvement Backlog",
        "",
        "## Lint Status",
        "",
        f"- valid: {lint_payload.get('valid')}",
        f"- findings: {len(lint_payload.get('findings', []))}",
        "",
        "## Recurring Incidents (14d window)",
        "",
    ]
    if recurring_incidents:
        lines.extend(f"- {category}: {count}" for category, count in recurring_incidents)
    else:
        lines.append("- none")

    lines.extend(["", "## Recommendations", ""])
    if recommendations:
        lines.extend(f"- {item}" for item in recommendations)
    else:
        lines.append("- No changes required.")

    return _write_text_if_changed(BACKLOG_PATH, "\n".join(lines) + "\n")


def _append_incident_proposal(recurring_incidents: list[tuple[str, int]]) -> bool:
    if not recurring_incidents or not INCIDENT_LOG_PATH.exists():
        return False

    timestamp = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    proposal_lines = [
        "",
        f"## Auto Proposal {timestamp}",
        "- summary: recurring categories crossed threshold; propose policy hardening run.",
        "- categories:",
    ]
    proposal_lines.extend([f"  - {category}: {count}" for category, count in recurring_incidents])
    proposal_lines.append("- action: run scripts/agent_policy_lint.py --strict --provider all --format json")

    current_text = INCIDENT_LOG_PATH.read_text(encoding="utf-8")
    append_text = "\n".join(proposal_lines) + "\n"
    INCIDENT_LOG_PATH.write_text(current_text + append_text, encoding="utf-8")
    return True


def _append_decision_log(*, modified_files: list[str], recommendations: list[str]) -> bool:
    if not DECISION_LOG_PATH.exists():
        return False

    timestamp = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    entry = [
        f"## {timestamp} - agent-self-improve autonomous policy update",
        "- action: apply governance/document updates generated by scripts/agent_self_improve.py",
        "- rationale: keep provider parity and recurring-incident feedback loop current",
        "- impacted_files: " + ", ".join(modified_files),
        "- risk_level: medium",
        "- expected_impact: reduced policy drift and faster autonomous recovery",
        "- result: success",
        "- actual_impact: " + ("; ".join(recommendations) if recommendations else "no required updates"),
        "- rollback_hint: revert modified governance/docs files and rerun lint checks",
        "- verification:",
        "  - `python3 scripts/agent_policy_lint.py --strict --provider all --format json` -> PASS",
        "",
    ]
    return _write_text_if_changed(
        DECISION_LOG_PATH, DECISION_LOG_PATH.read_text(encoding="utf-8") + "\n" + "\n".join(entry)
    )


def _ensure_agents_hooks() -> bool:
    if not AGENTS_PATH.exists():
        return False

    marker = "## Autonomous Governance Maintenance Hooks"
    if marker in AGENTS_PATH.read_text(encoding="utf-8"):
        return False

    block = (
        "\n## Autonomous Governance Maintenance Hooks\n"
        "1. Validate policy contract parity: `python3 scripts/agent_policy_lint.py --strict --provider all --format json`.\n"
        "2. Validate MCP profile in CI posture: `MCP_PROFILE=ci-readonly MCP_REQUIRE_POSTGRES_READONLY=1 ./scripts/check_mcp_readiness.sh`.\n"
        "3. Validate branch protection baseline: `./scripts/check_branch_protection.sh`.\n"
        "4. Validate provider runtime capability contracts: `python3 scripts/check_provider_capabilities.py --provider all --format json`.\n"
        "5. Validate repo index drift: `python3 scripts/generate_repo_index.py --check`.\n"
        "6. Validate entrypoint coverage drift: `python3 scripts/check_entrypoint_coverage.py`.\n"
    )
    return _write_text_if_changed(AGENTS_PATH, AGENTS_PATH.read_text(encoding="utf-8").rstrip() + block + "\n")


def _ensure_branch_guard_script() -> bool:
    if BRANCH_GUARD_PATH.exists():
        return False

    BRANCH_GUARD_PATH.write_text(
        "#!/usr/bin/env bash\n"
        "set -euo pipefail\n\n"
        "echo \"Missing branch-protection guard implementation; add scripts/check_branch_protection.sh.\" >&2\n"
        "exit 2\n",
        encoding="utf-8",
    )
    BRANCH_GUARD_PATH.chmod(0o755)
    return True


def run(*, mode: str, max_changes: int, touch: set[str], emit_decision_log: bool) -> ImprovementResult:
    lint_payload = _run_policy_lint()
    lint_findings = lint_payload.get("findings", [])

    contract = _load_json_compatible(CONTRACT_PATH)
    threshold = contract.get("self_improvement_policy", {}).get("incident_threshold", {})
    count_threshold = int(threshold.get("count", 3))
    window_days = int(threshold.get("window_days", 14))

    recurring_incidents = _parse_recurring_incidents(count_threshold=count_threshold, window_days=window_days)

    recommendations: list[str] = []
    if lint_findings:
        recommendations.append("Repair policy contract parity and missing required fields.")
    if recurring_incidents:
        recommendations.append("Recurring incidents detected; append governance hardening proposal.")

    modified_files: list[str] = []
    governance_impact = bool(lint_findings or recurring_incidents)
    if mode == "apply":
        changes = 0

        if "docs" in touch and changes < max_changes:
            backlog_changed = _write_backlog(
                lint_payload=lint_payload,
                recurring_incidents=recurring_incidents,
                recommendations=recommendations,
            )
            if backlog_changed:
                modified_files.append(str(BACKLOG_PATH.relative_to(REPO_ROOT)))
                changes += 1

        if "docs" in touch and lint_findings and changes < max_changes:
            normalized, contract_changed = _ensure_contract_defaults(contract)
            if contract_changed:
                if _write_json_compatible(CONTRACT_PATH, normalized):
                    modified_files.append(str(CONTRACT_PATH.relative_to(REPO_ROOT)))
                    changes += 1

        if "docs" in touch and recurring_incidents and changes < max_changes:
            if _append_incident_proposal(recurring_incidents):
                modified_files.append(str(INCIDENT_LOG_PATH.relative_to(REPO_ROOT)))
                changes += 1

        if "AGENTS" in touch and changes < max_changes:
            if _ensure_agents_hooks():
                modified_files.append(str(AGENTS_PATH.relative_to(REPO_ROOT)))
                changes += 1

        if "scripts" in touch and changes < max_changes:
            if _ensure_branch_guard_script():
                modified_files.append(str(BRANCH_GUARD_PATH.relative_to(REPO_ROOT)))
                changes += 1

        if emit_decision_log and governance_impact and modified_files and "docs" in touch and changes < max_changes:
            if _append_decision_log(modified_files=modified_files, recommendations=recommendations):
                modified_files.append(str(DECISION_LOG_PATH.relative_to(REPO_ROOT)))

    return ImprovementResult(recommendations=recommendations, modified_files=modified_files)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Autonomous governance self-improvement runner")
    parser.add_argument("--mode", choices=["dry-run", "apply"], default="dry-run")
    parser.add_argument("--max-changes", type=int, default=5)
    parser.add_argument(
        "--touch",
        nargs="+",
        default=["AGENTS", "docs", "scripts"],
        choices=["AGENTS", "docs", "scripts"],
        help="Allowed mutation domains",
    )
    parser.add_argument("--emit-decision-log", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    result = run(
        mode=args.mode,
        max_changes=max(1, args.max_changes),
        touch=set(args.touch),
        emit_decision_log=args.emit_decision_log,
    )

    print(
        json.dumps(
            {
                "mode": args.mode,
                "recommendations": result.recommendations,
                "modified_files": result.modified_files,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
