import json
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.database import AsyncSessionLocal
from app.models.audit import AuditLog

_MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_body: dict[str, Any] | None = None
        if request.method in _MUTATING_METHODS:
            request_body = await _read_body(request)

        response = await call_next(request)

        if request.method in _MUTATING_METHODS and request.url.path.startswith("/api"):
            entity, entity_id = _parse_entity(request.url.path)
            request_id = getattr(request.state, "request_id", "unknown")
            user_id = getattr(request.state, "user_id", None)
            ip_address = request.client.host if request.client else None

            audit_entry = AuditLog(
                request_id=request_id,
                user_id=user_id,
                action=request.method,
                entity=entity,
                entity_id=entity_id,
                old_values=None,
                new_values=request_body,
                status_code=response.status_code,
                ip_address=ip_address,
                error_message=None if response.status_code < 400 else "request failed",
            )

            async with AsyncSessionLocal() as session:
                session.add(audit_entry)
                try:
                    await session.commit()
                except Exception:
                    await session.rollback()

        return response


async def _read_body(request: Request) -> dict[str, Any] | None:
    content_type = request.headers.get("content-type", "")
    body = await request.body()

    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}

    request._receive = receive

    if not body:
        return None

    if "application/json" in content_type:
        try:
            return json.loads(body.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return {"raw_body": body.decode("utf-8", errors="ignore")}

    return {"raw_body": body.decode("utf-8", errors="ignore")}


def _parse_entity(path: str) -> tuple[str, str | None]:
    parts = [part for part in path.split("/") if part]
    if len(parts) < 2:
        return ("unknown", None)
    entity = parts[1]
    entity_id = parts[2] if len(parts) > 2 else None
    return (entity, entity_id)
