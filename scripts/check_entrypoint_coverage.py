#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ENTRYPOINTS_DIR = REPO_ROOT / "docs/agents/entrypoints"
INDEX_PATH = REPO_ROOT / "docs/agents/repo-index.json"
ROUTERS_DIR = REPO_ROOT / "backend/app/routers"


def _load_index() -> dict:
    if not INDEX_PATH.exists():
        raise FileNotFoundError(f"Missing repository index: {INDEX_PATH}")
    return json.loads(INDEX_PATH.read_text(encoding="utf-8"))


def _expected_entrypoint_files(modules: list[str]) -> set[str]:
    expected = {f"{module}.md" for module in modules}
    expected.add("frontend_pages.md")
    return expected


def _discover_router_modules() -> set[str]:
    modules: set[str] = set()
    ignore_suffixes = ("_helpers", "_workflow", "_queries", "_batch_queries", "_common")
    ignore_stems = {"returns_orders", "returns_items"}

    for path in ROUTERS_DIR.glob("*.py"):
        stem = path.stem
        if stem == "__init__":
            continue
        if stem in ignore_stems:
            continue
        if stem.endswith(ignore_suffixes):
            continue
        modules.add(stem)

    for path in ROUTERS_DIR.iterdir():
        if path.is_dir() and path.name != "__pycache__":
            modules.add(path.name)

    return modules


def main() -> int:
    findings: list[str] = []
    try:
        payload = _load_index()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 2

    modules = payload.get("active_modules")
    module_entries = payload.get("modules")
    if not isinstance(modules, list) or not all(isinstance(item, str) for item in modules):
        print("repo-index.json missing valid active_modules", file=sys.stderr)
        return 2
    if not isinstance(module_entries, list):
        print("repo-index.json missing valid modules list", file=sys.stderr)
        return 2

    expected_docs = _expected_entrypoint_files(modules)
    existing_docs = {path.name for path in ENTRYPOINTS_DIR.glob("*.md")}

    missing_docs = sorted(expected_docs - existing_docs)
    if missing_docs:
        findings.append("missing entrypoint docs: " + ", ".join(missing_docs))

    discovered_modules = _discover_router_modules()
    declared_modules = set(modules)
    missing_in_index = sorted(discovered_modules - declared_modules)
    if missing_in_index:
        findings.append("router modules missing from repo-index active_modules: " + ", ".join(missing_in_index))

    stale_in_index = sorted(declared_modules - discovered_modules)
    if stale_in_index:
        findings.append("stale modules in repo-index active_modules: " + ", ".join(stale_in_index))

    for entry in module_entries:
        module = entry.get("module") if isinstance(entry, dict) else None
        routers = entry.get("routers") if isinstance(entry, dict) else None
        if not isinstance(module, str):
            findings.append("repo-index contains invalid module entry")
            continue
        if not isinstance(routers, list) or not routers:
            findings.append(f"module '{module}' has no router mapping in repo-index.json")

    if findings:
        print("Entrypoint coverage check failed:")
        for finding in findings:
            print(f"  - {finding}")
        print("Regenerate index with: python3 scripts/generate_repo_index.py --write")
        return 1

    print("Entrypoint coverage check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
