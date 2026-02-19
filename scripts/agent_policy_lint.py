#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shlex
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
CONTRACT_PATH = REPO_ROOT / "docs/agents/policy.contract.yaml"
SCHEMA_PATH = REPO_ROOT / "docs/agents/policy.schema.json"

REQUIRED_ROOT_FIELDS = {
    "autonomy_mode",
    "decision_classes",
    "high_risk_protocol",
    "provider_matrix",
    "self_improvement_policy",
    "required_gates",
}

REQUIRED_PROVIDERS = ("openai", "anthropic", "google")
REQUIRED_PROVIDER_FIELDS = {"adapter_file", "policy_doc", "required_capabilities", "fallback_order"}


def _load_data(path: Path) -> Any:
    text = path.read_text(encoding="utf-8")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        try:
            import yaml  # type: ignore
        except Exception as exc:  # pragma: no cover - dependency optional
            raise RuntimeError(
                f"Could not parse {path}. Provide JSON-compatible YAML or install PyYAML."
            ) from exc
        return yaml.safe_load(text)


def _path_exists(path_like: str) -> bool:
    path = REPO_ROOT / path_like
    return path.exists()


def _gate_path_from_command(command: str) -> Path | None:
    try:
        tokens = shlex.split(command)
    except ValueError:
        return None
    if not tokens:
        return None

    # direct executable path
    head = tokens[0]
    if head.startswith("./"):
        return REPO_ROOT / head[2:]

    # python invocation
    if head in {"python", "python3"} and len(tokens) >= 2 and tokens[1].endswith((".py", ".sh")):
        return REPO_ROOT / tokens[1]

    return None


def validate_contract(contract: dict[str, Any], *, strict: bool, provider: str) -> list[str]:
    findings: list[str] = []

    missing = sorted(REQUIRED_ROOT_FIELDS - set(contract.keys()))
    if missing:
        findings.append(f"Missing required root fields: {', '.join(missing)}")

    autonomy_mode = contract.get("autonomy_mode")
    if autonomy_mode != "unrestricted_senior":
        findings.append("autonomy_mode must be 'unrestricted_senior'")

    decision_classes = contract.get("decision_classes")
    if not isinstance(decision_classes, list) or sorted(set(decision_classes)) != ["ask_once", "auto_execute"]:
        findings.append("decision_classes must contain exactly ['auto_execute', 'ask_once']")

    high_risk = contract.get("high_risk_protocol")
    if not isinstance(high_risk, dict):
        findings.append("high_risk_protocol must be an object")
    else:
        log_path = high_risk.get("decision_log_path")
        if not isinstance(log_path, str) or not log_path:
            findings.append("high_risk_protocol.decision_log_path must be a non-empty string")
        elif strict and not _path_exists(log_path):
            findings.append(f"high_risk_protocol.decision_log_path does not exist: {log_path}")
        if high_risk.get("requires_pre_and_post_entry") is not True:
            findings.append("high_risk_protocol.requires_pre_and_post_entry must be true")

    provider_matrix = contract.get("provider_matrix")
    if not isinstance(provider_matrix, dict):
        findings.append("provider_matrix must be an object")
        provider_matrix = {}

    providers_to_check = REQUIRED_PROVIDERS if provider == "all" else (provider,)
    for provider_name in providers_to_check:
        provider_data = provider_matrix.get(provider_name)
        if not isinstance(provider_data, dict):
            findings.append(f"provider_matrix.{provider_name} missing or invalid")
            continue

        missing_fields = sorted(REQUIRED_PROVIDER_FIELDS - set(provider_data.keys()))
        if missing_fields:
            findings.append(
                f"provider_matrix.{provider_name} missing fields: {', '.join(missing_fields)}"
            )

        adapter_file = provider_data.get("adapter_file")
        if not isinstance(adapter_file, str) or not adapter_file:
            findings.append(f"provider_matrix.{provider_name}.adapter_file must be a non-empty string")
        elif strict and not _path_exists(adapter_file):
            findings.append(f"provider_matrix.{provider_name}.adapter_file missing: {adapter_file}")

        policy_doc = provider_data.get("policy_doc")
        if not isinstance(policy_doc, str) or not policy_doc:
            findings.append(f"provider_matrix.{provider_name}.policy_doc must be a non-empty string")
        elif strict and not _path_exists(policy_doc):
            findings.append(f"provider_matrix.{provider_name}.policy_doc missing: {policy_doc}")

        capabilities = provider_data.get("required_capabilities")
        if not isinstance(capabilities, list) or not capabilities:
            findings.append(f"provider_matrix.{provider_name}.required_capabilities must be a non-empty list")

        fallback_order = provider_data.get("fallback_order")
        if not isinstance(fallback_order, list) or not fallback_order:
            findings.append(f"provider_matrix.{provider_name}.fallback_order must be a non-empty list")
        elif fallback_order[0] != "AGENTS.md":
            findings.append(f"provider_matrix.{provider_name}.fallback_order must start with AGENTS.md")

    self_improvement = contract.get("self_improvement_policy")
    if not isinstance(self_improvement, dict):
        findings.append("self_improvement_policy must be an object")
    else:
        if self_improvement.get("enabled") is not True:
            findings.append("self_improvement_policy.enabled must be true")
        runner_script = self_improvement.get("runner_script")
        if not isinstance(runner_script, str) or not runner_script:
            findings.append("self_improvement_policy.runner_script must be a non-empty string")
        elif strict and not _path_exists(runner_script):
            findings.append(f"self_improvement_policy.runner_script missing: {runner_script}")

        max_changes = self_improvement.get("max_changes_per_run")
        if not isinstance(max_changes, int) or max_changes <= 0:
            findings.append("self_improvement_policy.max_changes_per_run must be > 0")

        allowlist = self_improvement.get("touch_allowlist")
        expected_allowlist = {"AGENTS", "docs", "scripts"}
        if not isinstance(allowlist, list) or not allowlist:
            findings.append("self_improvement_policy.touch_allowlist must be a non-empty list")
        elif strict and not set(allowlist).issubset(expected_allowlist):
            findings.append("self_improvement_policy.touch_allowlist contains unsupported values")

        threshold = self_improvement.get("incident_threshold")
        if not isinstance(threshold, dict):
            findings.append("self_improvement_policy.incident_threshold must be an object")
        else:
            count = threshold.get("count")
            window_days = threshold.get("window_days")
            if not isinstance(count, int) or count < 1:
                findings.append("self_improvement_policy.incident_threshold.count must be >= 1")
            if not isinstance(window_days, int) or window_days < 1:
                findings.append("self_improvement_policy.incident_threshold.window_days must be >= 1")

    required_gates = contract.get("required_gates")
    if not isinstance(required_gates, list) or not required_gates:
        findings.append("required_gates must be a non-empty list")
    elif strict:
        for command in required_gates:
            if not isinstance(command, str) or not command.strip():
                findings.append("required_gates entries must be non-empty strings")
                continue
            gate_path = _gate_path_from_command(command)
            if gate_path is not None and not gate_path.exists():
                findings.append(f"required_gates references missing path: {gate_path.relative_to(REPO_ROOT)}")

    return findings


def _render_markdown(payload: dict[str, Any]) -> str:
    lines = [
        "# Agent Policy Lint",
        "",
        f"- valid: {payload['valid']}",
        f"- strict: {payload['strict']}",
        f"- provider: {payload['provider']}",
        f"- contract: {payload['contract_path']}",
        f"- schema: {payload['schema_path']}",
        "",
        "## Findings",
        "",
    ]
    findings = payload.get("findings", [])
    if findings:
        lines.extend(f"- {item}" for item in findings)
    else:
        lines.append("- None")
    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate DirectStock agent policy contract")
    parser.add_argument("--strict", action="store_true", help="Enable path and parity checks")
    parser.add_argument(
        "--provider",
        choices=["openai", "anthropic", "google", "all"],
        default="all",
        help="Validate one provider section or all",
    )
    parser.add_argument("--format", choices=["md", "json"], default="md", help="Output format")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if not CONTRACT_PATH.exists():
        print(f"Missing contract file: {CONTRACT_PATH}", file=sys.stderr)
        return 2
    if not SCHEMA_PATH.exists():
        print(f"Missing schema file: {SCHEMA_PATH}", file=sys.stderr)
        return 2

    try:
        contract = _load_data(CONTRACT_PATH)
        _ = _load_data(SCHEMA_PATH)
    except Exception as exc:
        print(f"Failed to load policy files: {exc}", file=sys.stderr)
        return 2

    if not isinstance(contract, dict):
        print("Policy contract must be an object", file=sys.stderr)
        return 2

    findings = validate_contract(contract, strict=args.strict, provider=args.provider)

    payload = {
        "valid": len(findings) == 0,
        "strict": args.strict,
        "provider": args.provider,
        "contract_path": str(CONTRACT_PATH.relative_to(REPO_ROOT)),
        "schema_path": str(SCHEMA_PATH.relative_to(REPO_ROOT)),
        "findings": findings,
    }

    if args.format == "json":
        print(json.dumps(payload, indent=2))
    else:
        print(_render_markdown(payload))

    return 0 if payload["valid"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
