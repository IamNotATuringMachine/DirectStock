#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
MCP_PATH = REPO_ROOT / ".mcp.json"
IDX_PATH = REPO_ROOT / ".idx/mcp.json"
GEMINI_PATH = REPO_ROOT / ".gemini/settings.json"

REQUIRED_PROFILES = ("dev-autonomy", "triage-readonly", "review-governance")
REQUIRED_MEMORY_SERVER = "directstock-memory"


def load_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"invalid json in {path.relative_to(REPO_ROOT)}: {exc}") from exc
    except FileNotFoundError as exc:
        raise RuntimeError(f"missing file: {path.relative_to(REPO_ROOT)}") from exc


def normalize_profile(profile: Any) -> dict[str, Any] | None:
    if not isinstance(profile, dict):
        return None
    servers = profile.get("servers")
    if not isinstance(servers, list) or not all(isinstance(item, str) for item in servers):
        return None
    env = profile.get("env")
    if env is None:
        env = {}
    if not isinstance(env, dict):
        return None
    return {"servers": sorted(servers), "env": {str(k): str(v) for k, v in sorted(env.items())}}


def render_md(payload: dict[str, Any]) -> str:
    lines = [
        "# MCP Profile Parity",
        "",
        f"- valid: {payload['valid']}",
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
    parser = argparse.ArgumentParser(description="Validate parity across .mcp.json, .idx/mcp.json and .gemini/settings.json")
    parser.add_argument("--strict", action="store_true", help="Require directstock-memory across MCP server maps")
    parser.add_argument("--format", choices=["md", "json"], default="md", help="Output format")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        mcp_payload = load_json(MCP_PATH)
        idx_payload = load_json(IDX_PATH)
        gemini_payload = load_json(GEMINI_PATH)
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 2

    findings: list[str] = []

    mcp_servers = mcp_payload.get("mcpServers")
    idx_servers = idx_payload.get("mcpServers")
    gemini_servers = gemini_payload.get("mcpServers")

    if not isinstance(mcp_servers, dict):
        findings.append(".mcp.json.mcpServers missing or invalid")
        mcp_servers = {}
    if not isinstance(idx_servers, dict):
        findings.append(".idx/mcp.json.mcpServers missing or invalid")
        idx_servers = {}
    if not isinstance(gemini_servers, dict):
        findings.append(".gemini/settings.json.mcpServers missing or invalid")
        gemini_servers = {}

    mcp_server_set = set(mcp_servers)
    idx_server_set = set(idx_servers)
    gemini_server_set = set(gemini_servers)

    if mcp_server_set != idx_server_set:
        findings.append(
            ".mcp.json and .idx/mcp.json server sets differ: "
            f"mcp_only={sorted(mcp_server_set - idx_server_set)}, "
            f"idx_only={sorted(idx_server_set - mcp_server_set)}"
        )

    if mcp_server_set != gemini_server_set:
        findings.append(
            ".mcp.json and .gemini/settings.json server sets differ: "
            f"mcp_only={sorted(mcp_server_set - gemini_server_set)}, "
            f"gemini_only={sorted(gemini_server_set - mcp_server_set)}"
        )

    mcp_profiles = mcp_payload.get("profiles")
    idx_profiles = idx_payload.get("profiles")
    if not isinstance(mcp_profiles, dict):
        findings.append(".mcp.json.profiles missing or invalid")
        mcp_profiles = {}
    if not isinstance(idx_profiles, dict):
        findings.append(".idx/mcp.json.profiles missing or invalid")
        idx_profiles = {}

    for profile_name in REQUIRED_PROFILES:
        mcp_profile = normalize_profile(mcp_profiles.get(profile_name))
        idx_profile = normalize_profile(idx_profiles.get(profile_name))
        if mcp_profile is None:
            findings.append(f".mcp.json.profiles.{profile_name} missing or invalid")
            continue
        if idx_profile is None:
            findings.append(f".idx/mcp.json.profiles.{profile_name} missing or invalid")
            continue
        if mcp_profile != idx_profile:
            findings.append(
                f"profile mismatch for {profile_name}: "
                f"mcp={json.dumps(mcp_profile, sort_keys=True)} "
                f"idx={json.dumps(idx_profile, sort_keys=True)}"
            )

    if args.strict:
        if REQUIRED_MEMORY_SERVER not in mcp_server_set:
            findings.append(f"strict mode: {REQUIRED_MEMORY_SERVER} missing in .mcp.json.mcpServers")
        if REQUIRED_MEMORY_SERVER not in idx_server_set:
            findings.append(f"strict mode: {REQUIRED_MEMORY_SERVER} missing in .idx/mcp.json.mcpServers")
        if REQUIRED_MEMORY_SERVER not in gemini_server_set:
            findings.append(f"strict mode: {REQUIRED_MEMORY_SERVER} missing in .gemini/settings.json.mcpServers")

    payload = {
        "valid": len(findings) == 0,
        "strict": args.strict,
        "findings": findings,
    }

    if args.format == "json":
        print(json.dumps(payload, indent=2))
    else:
        print(render_md(payload))

    return 0 if payload["valid"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
