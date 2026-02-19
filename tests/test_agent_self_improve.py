from __future__ import annotations

import json
from pathlib import Path

import scripts.agent_self_improve as self_improve


def _write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def _minimal_contract() -> dict:
    return {
        "autonomy_mode": "unrestricted_senior",
        "decision_classes": ["auto_execute", "ask_once"],
        "high_risk_protocol": {
            "decision_log_path": "docs/agents/decision-log.md",
            "requires_pre_and_post_entry": True,
        },
        "provider_matrix": {
            "openai": {
                "adapter_file": "CODEX.md",
                "policy_doc": "docs/agents/providers/openai.md",
                "required_capabilities": ["responses_api"],
                "fallback_order": ["AGENTS.md", "docs/agents/providers/openai.md", "CODEX.md"],
            },
            "anthropic": {
                "adapter_file": "CLAUDE.md",
                "policy_doc": "docs/agents/providers/anthropic.md",
                "required_capabilities": ["claude_code_hooks"],
                "fallback_order": ["AGENTS.md", "docs/agents/providers/anthropic.md", "CLAUDE.md"],
            },
            "google": {
                "adapter_file": "GEMINI.md",
                "policy_doc": "docs/agents/providers/google.md",
                "required_capabilities": ["adk_workflows"],
                "fallback_order": ["AGENTS.md", "docs/agents/providers/google.md", "GEMINI.md"],
            },
        },
        "provider_runtime_contracts": {
            "openai": {"required_behaviors": ["responses_api_first"], "verification_artifacts": ["AGENTS.md"]},
            "anthropic": {"required_behaviors": ["claude_code_hooks_available"], "verification_artifacts": ["AGENTS.md"]},
            "google": {"required_behaviors": ["adk_workflows_supported"], "verification_artifacts": ["AGENTS.md"]},
        },
        "eval_gates": ["./scripts/agent_governance_check.sh"],
        "self_improvement_noise_guard": {
            "enabled": True,
            "block_timestamp_only_churn": True,
            "require_semantic_diff_for_pr": True,
        },
        "self_improvement_policy": {
            "enabled": True,
            "runner_script": "scripts/agent_self_improve.py",
            "max_changes_per_run": 5,
            "touch_allowlist": ["AGENTS", "docs", "scripts"],
            "incident_threshold": {"count": 3, "window_days": 14},
        },
        "required_gates": ["./scripts/agent_governance_check.sh"],
    }


def test_write_backlog_has_no_timestamp_only_churn(tmp_path, monkeypatch) -> None:
    backlog_path = tmp_path / "auto-improvement-backlog.md"
    monkeypatch.setattr(self_improve, "BACKLOG_PATH", backlog_path)

    payload = {"valid": True, "findings": []}
    changed_first = self_improve._write_backlog(  # type: ignore[attr-defined]
        lint_payload=payload, recurring_incidents=[], recommendations=[]
    )
    changed_second = self_improve._write_backlog(  # type: ignore[attr-defined]
        lint_payload=payload, recurring_incidents=[], recommendations=[]
    )

    assert changed_first is True
    assert changed_second is False


def test_dry_run_without_drift_changes_nothing(tmp_path, monkeypatch) -> None:
    contract_path = tmp_path / "policy.contract.yaml"
    incident_path = tmp_path / "incident-log.md"
    decision_path = tmp_path / "decision-log.md"
    backlog_path = tmp_path / "auto-improvement-backlog.md"
    agents_path = tmp_path / "AGENTS.md"
    branch_guard = tmp_path / "check_branch_protection.sh"

    _write_json(contract_path, _minimal_contract())
    incident_path.write_text("# Incident Log\n", encoding="utf-8")
    decision_path.write_text("# Decision Log\n", encoding="utf-8")
    agents_path.write_text("# AGENTS\n", encoding="utf-8")
    branch_guard.write_text("#!/usr/bin/env bash\n", encoding="utf-8")

    monkeypatch.setattr(self_improve, "CONTRACT_PATH", contract_path)
    monkeypatch.setattr(self_improve, "INCIDENT_LOG_PATH", incident_path)
    monkeypatch.setattr(self_improve, "DECISION_LOG_PATH", decision_path)
    monkeypatch.setattr(self_improve, "BACKLOG_PATH", backlog_path)
    monkeypatch.setattr(self_improve, "AGENTS_PATH", agents_path)
    monkeypatch.setattr(self_improve, "BRANCH_GUARD_PATH", branch_guard)
    monkeypatch.setattr(self_improve, "_run_policy_lint", lambda: {"valid": True, "findings": []})
    monkeypatch.setattr(self_improve, "_parse_recurring_incidents", lambda **_: [])

    result = self_improve.run(mode="dry-run", max_changes=5, touch={"AGENTS", "docs", "scripts"}, emit_decision_log=True)

    assert result.recommendations == []
    assert result.modified_files == []
    assert not backlog_path.exists()
