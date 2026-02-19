#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
CONTRACT_PATH = REPO_ROOT / "docs/agents/policy.contract.yaml"
PROFILE_DOCS = {
    "openai": REPO_ROOT / "docs/agents/providers/openai.md",
    "anthropic": REPO_ROOT / "docs/agents/providers/anthropic.md",
    "google": REPO_ROOT / "docs/agents/providers/google.md",
}
REQUIRED_PROVIDERS = ("openai", "anthropic", "google")

BEHAVIOR_KEYWORDS = {
    "responses_api_first": ["responses", "responses-native"],
    "conversation_state_preserved": ["conversation_state", "state"],
    "background_mode_for_long_tasks": ["background_mode", "background"],
    "remote_mcp_tooling_supported": ["mcp", "tooling"],
    "tool_result_traceability": ["verification", "evidence", "artifact"],
    "claude_code_hooks_available": ["hooks"],
    "memory_files_supported": ["memory"],
    "prompt_caching_supported": ["prompt caching", "cache"],
    "mcp_connector_supported": ["connector", "mcp"],
    "adk_workflows_supported": ["adk", "workflow"],
    "agent_engine_patterns_supported": ["agent_engine", "agent engine", "pattern"],
    "a2a_interoperability_supported": ["a2a", "interoperability"],
    "mcp_tooling_supported": ["mcp", "tooling"],
}


def _load_json_compatible(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    return json.loads(text)


def _keyword_match(content: str, behavior: str) -> bool:
    keywords = BEHAVIOR_KEYWORDS.get(behavior)
    if not keywords:
        return True
    lowered = content.lower()
    return any(keyword.lower() in lowered for keyword in keywords)


def _validate_provider(
    *,
    provider: str,
    runtime_contracts: dict[str, Any],
    strict: bool,
) -> list[str]:
    findings: list[str] = []
    profile_doc = PROFILE_DOCS[provider]
    contract = runtime_contracts.get(provider)

    if not isinstance(contract, dict):
        return [f"provider_runtime_contracts.{provider} missing or invalid"]

    required_behaviors = contract.get("required_behaviors")
    if not isinstance(required_behaviors, list) or not required_behaviors:
        findings.append(f"provider_runtime_contracts.{provider}.required_behaviors must be a non-empty list")
        required_behaviors = []

    verification_artifacts = contract.get("verification_artifacts")
    if not isinstance(verification_artifacts, list) or not verification_artifacts:
        findings.append(f"provider_runtime_contracts.{provider}.verification_artifacts must be a non-empty list")
        verification_artifacts = []

    profile_text = ""
    if strict:
        if not profile_doc.exists():
            findings.append(f"provider profile missing: {profile_doc.relative_to(REPO_ROOT)}")
        else:
            profile_text = profile_doc.read_text(encoding="utf-8")

    for artifact in verification_artifacts:
        if not isinstance(artifact, str) or not artifact:
            findings.append(f"provider_runtime_contracts.{provider}.verification_artifacts contains invalid entry")
            continue
        artifact_path = REPO_ROOT / artifact
        if strict and not artifact_path.exists():
            findings.append(f"provider_runtime_contracts.{provider}.verification_artifact missing: {artifact}")

    if strict and profile_text:
        for behavior in required_behaviors:
            if not isinstance(behavior, str) or not behavior:
                findings.append(f"provider_runtime_contracts.{provider}.required_behaviors contains invalid entry")
                continue
            if not _keyword_match(profile_text, behavior):
                findings.append(
                    f"provider profile docs/agents/providers/{provider}.md missing behavior evidence for: {behavior}"
                )

    return findings


def _render_markdown(payload: dict[str, Any]) -> str:
    lines = [
        "# Provider Capability Check",
        "",
        f"- valid: {payload['valid']}",
        f"- provider: {payload['provider']}",
        f"- strict: {payload['strict']}",
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
    parser = argparse.ArgumentParser(description="Validate provider runtime capability contracts")
    parser.add_argument(
        "--provider",
        choices=["openai", "anthropic", "google", "all"],
        default="all",
        help="Validate one provider section or all",
    )
    parser.add_argument("--strict", action="store_true", help="Enable file/path and documentation evidence checks")
    parser.add_argument("--format", choices=["md", "json"], default="md", help="Output format")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not CONTRACT_PATH.exists():
        print(f"Missing contract file: {CONTRACT_PATH}", file=sys.stderr)
        return 2

    try:
        contract = _load_json_compatible(CONTRACT_PATH)
    except Exception as exc:
        print(f"Failed to load policy contract: {exc}", file=sys.stderr)
        return 2

    runtime_contracts = contract.get("provider_runtime_contracts")
    findings: list[str] = []
    if not isinstance(runtime_contracts, dict):
        findings.append("provider_runtime_contracts must be an object")
        runtime_contracts = {}

    providers_to_check = REQUIRED_PROVIDERS if args.provider == "all" else (args.provider,)
    for provider in providers_to_check:
        findings.extend(_validate_provider(provider=provider, runtime_contracts=runtime_contracts, strict=args.strict))

    payload = {
        "valid": len(findings) == 0,
        "provider": args.provider,
        "strict": args.strict,
        "contract_path": str(CONTRACT_PATH.relative_to(REPO_ROOT)),
        "findings": findings,
    }

    if args.format == "json":
        print(json.dumps(payload, indent=2))
    else:
        print(_render_markdown(payload))

    return 0 if payload["valid"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
