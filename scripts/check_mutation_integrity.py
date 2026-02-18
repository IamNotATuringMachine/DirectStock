#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

from fastapi.routing import APIRoute

ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import app  # noqa: E402
from app.middleware.audit import AuditMiddleware  # noqa: E402
from app.middleware.idempotency import IdempotencyMiddleware  # noqa: E402

MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
PUBLIC_MUTATION_ALLOWLIST = {
    ("POST", "/api/auth/login"),
    ("POST", "/api/auth/refresh"),
    ("POST", "/api/external/token"),
    ("POST", "/api/carriers/{carrier}/webhook"),
}


def _fail(message: str) -> None:
    print(f"[mutation-integrity] {message}", file=sys.stderr)


def main() -> int:
    middleware_classes = {entry.cls for entry in app.user_middleware}
    if AuditMiddleware not in middleware_classes:
        _fail("AuditMiddleware is not registered")
        return 1
    if IdempotencyMiddleware not in middleware_classes:
        _fail("IdempotencyMiddleware is not registered")
        return 1

    spec = app.openapi()
    paths = spec.get("paths", {})

    unguarded: list[str] = []
    missing_openapi_ops: list[str] = []

    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        if not route.path.startswith("/api"):
            continue

        for method in sorted(route.methods.intersection(MUTATING_METHODS)):
            op_key = (method, route.path)
            if op_key in PUBLIC_MUTATION_ALLOWLIST:
                continue

            operation = paths.get(route.path, {}).get(method.lower())
            if operation is None:
                missing_openapi_ops.append(f"{method} {route.path}")
                continue

            security = operation.get("security")
            if not security:
                unguarded.append(f"{method} {route.path}")

    if missing_openapi_ops:
        _fail("Missing OpenAPI operation entries:")
        for item in missing_openapi_ops:
            _fail(f"  - {item}")
        return 1

    if unguarded:
        _fail("Mutating endpoints without OpenAPI security requirements:")
        for item in unguarded:
            _fail(f"  - {item}")
        return 1

    print("[mutation-integrity] OK: middleware and mutating endpoint security checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
