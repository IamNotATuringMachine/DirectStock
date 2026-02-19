#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ROUTERS_DIR = REPO_ROOT / "backend/app/routers"
SERVICES_DIR = REPO_ROOT / "backend/app/services"
SCHEMAS_DIR = REPO_ROOT / "backend/app/schemas"
BACKEND_TESTS_DIR = REPO_ROOT / "backend/tests"
FRONTEND_PAGES_DIR = REPO_ROOT / "frontend/src/pages"
FRONTEND_E2E_DIR = REPO_ROOT / "frontend/tests/e2e"
OUTPUT_PATH = REPO_ROOT / "docs/agents/repo-index.json"

ACTIVE_MODULES = [
    "auth",
    "users",
    "products",
    "warehouses",
    "inventory",
    "operations",
    "dashboard",
    "customers",
    "suppliers",
    "product_settings",
    "purchasing",
    "inventory_counts",
    "reports",
    "alerts",
    "abc",
    "purchase_recommendations",
    "picking",
    "returns",
    "workflows",
    "documents",
    "audit_log",
    "external_api",
    "integration_clients",
    "shipping",
    "inter_warehouse_transfers",
    "permissions",
    "pages",
    "roles",
    "ui_preferences",
    "dashboard_config",
    "pricing",
    "sales_orders",
    "invoices",
]

FRONTEND_PAGE_FILES = sorted(path.name for path in FRONTEND_PAGES_DIR.glob("*Page.tsx"))


def _rel(path: Path) -> str:
    return str(path.relative_to(REPO_ROOT))


def _module_token(module: str) -> str:
    return module.replace("_", "-")


def _collect_router_paths(module: str) -> list[str]:
    result: list[str] = []
    file_candidate = ROUTERS_DIR / f"{module}.py"
    dir_candidate = ROUTERS_DIR / module
    if file_candidate.exists():
        result.append(_rel(file_candidate))
    if dir_candidate.exists():
        result.extend(_rel(path) for path in sorted(dir_candidate.glob("*.py")))
    return sorted(set(result))


def _collect_service_paths(module: str) -> list[str]:
    token = module.replace("_", "")
    result: list[str] = []
    for path in SERVICES_DIR.rglob("*.py"):
        rel = _rel(path)
        stem_token = path.stem.replace("_", "")
        if module in rel or token in stem_token:
            result.append(rel)
    return sorted(set(result))


def _collect_schema_paths(module: str) -> list[str]:
    token = module.replace("_", "")
    result: list[str] = []
    for path in SCHEMAS_DIR.glob("*.py"):
        stem_token = path.stem.replace("_", "")
        if module in path.stem or token in stem_token:
            result.append(_rel(path))
    return sorted(set(result))


def _collect_test_paths(module: str) -> list[str]:
    token = module.replace("_", "-")
    backend_matches = sorted(
        _rel(path)
        for path in BACKEND_TESTS_DIR.glob("test_*.py")
        if module in path.stem or token in path.stem or module.replace("_", "") in path.stem
    )
    frontend_matches = sorted(_rel(path) for path in FRONTEND_E2E_DIR.glob("*.spec.ts") if token in path.name)
    return sorted(set(backend_matches + frontend_matches))


def _collect_frontend_refs(module: str) -> list[str]:
    token = _module_token(module)
    result: list[str] = []
    for path in FRONTEND_PAGES_DIR.rglob("*.ts*"):
        name = path.name.lower()
        if token in name or module in name or module.replace("_", "") in name:
            result.append(_rel(path))
    return sorted(set(result))


def build_index() -> dict[str, object]:
    modules = []
    for module in ACTIVE_MODULES:
        modules.append(
            {
                "module": module,
                "routers": _collect_router_paths(module),
                "services": _collect_service_paths(module),
                "schemas": _collect_schema_paths(module),
                "tests": _collect_test_paths(module),
                "frontend": _collect_frontend_refs(module),
            }
        )
    return {
        "active_modules": ACTIVE_MODULES,
        "frontend_top_pages": FRONTEND_PAGE_FILES,
        "modules": modules,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate machine-readable repository index for agent navigation.")
    parser.add_argument("--write", action="store_true", help=f"Write output to {OUTPUT_PATH}")
    parser.add_argument("--check", action="store_true", help=f"Check whether {OUTPUT_PATH} matches generated output")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    payload = build_index()
    rendered = json.dumps(payload, indent=2) + "\n"

    if args.write:
        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT_PATH.write_text(rendered, encoding="utf-8")

    if args.check:
        if not OUTPUT_PATH.exists():
            print(f"Missing index file: {OUTPUT_PATH}", flush=True)
            return 1
        existing = OUTPUT_PATH.read_text(encoding="utf-8")
        if existing != rendered:
            print("Repository index drift detected. Run: python3 scripts/generate_repo_index.py --write", flush=True)
            return 1

    if not args.write and not args.check:
        print(rendered, end="")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
