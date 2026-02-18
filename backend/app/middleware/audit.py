import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.inspection import inspect as sa_inspect
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.database import AsyncSessionLocal
from app.models.audit import AuditLog
from app.models.auth import Role
from app.models.catalog import Customer, CustomerContact, CustomerLocation
from app.models.inventory import GoodsIssue, GoodsReceipt, InventoryCountSession, StockTransfer
from app.models.phase3 import (
    AbcClassificationRun,
    ApprovalRequest,
    ApprovalRule,
    Document,
    PickTask,
    PickWave,
    PurchaseRecommendation,
    ReturnOrder,
)
from app.models.phase4 import IntegrationClient, InterWarehouseTransfer, Shipment
from app.models.phase5 import AppPage, Invoice, SalesOrder, UserUiPreference
from app.models.purchasing import PurchaseOrder

_MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
_REDACT_KEYS = {
    "hashed_password",
    "password",
    "access_token",
    "refresh_token",
    "authorization",
    "cookie",
    "set-cookie",
}
_ENTITY_MODEL_MAP: dict[str, type[Any]] = {
    "customers": Customer,
    "customer-locations": CustomerLocation,
    "customer-contacts": CustomerContact,
    "purchase-orders": PurchaseOrder,
    "goods-receipts": GoodsReceipt,
    "goods-issues": GoodsIssue,
    "stock-transfers": StockTransfer,
    "inventory-counts": InventoryCountSession,
    "abc-classifications": AbcClassificationRun,
    "purchase-recommendations": PurchaseRecommendation,
    "pick-waves": PickWave,
    "pick-tasks": PickTask,
    "return-orders": ReturnOrder,
    "approval-rules": ApprovalRule,
    "approvals": ApprovalRequest,
    "documents": Document,
    "integration-clients": IntegrationClient,
    "shipments": Shipment,
    "inter-warehouse-transfers": InterWarehouseTransfer,
    "roles": Role,
    "pages": AppPage,
    "ui-preferences": UserUiPreference,
    "sales-orders": SalesOrder,
    "invoices": Invoice,
}


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        should_audit = request.method in _MUTATING_METHODS and request.url.path.startswith("/api")
        request_body: dict[str, Any] | None = None
        if should_audit:
            request_body = await _read_body(request)

        entity = "unknown"
        entity_id: str | None = None
        before_snapshot: dict[str, Any] | None = None
        tracked_model: type[Any] | None = None
        tracked_id: int | None = None
        if should_audit:
            entity, entity_id = _parse_entity(request.url.path)
            tracked_model = _ENTITY_MODEL_MAP.get(entity)
            tracked_id = _safe_int(entity_id)
            if tracked_model is not None and tracked_id is not None:
                before_snapshot = await _load_snapshot(tracked_model, tracked_id)

        response = await call_next(request)
        if not should_audit:
            return response

        response_bytes, replayable_response = await _materialize_response(response)
        response_payload = _try_parse_json(response_bytes)

        request_id = getattr(request.state, "request_id", "unknown")
        user_id = getattr(request.state, "user_id", None)
        ip_address = request.client.host if request.client else None

        if tracked_model is not None and tracked_id is None:
            tracked_id = _extract_entity_id_from_payload(entity, response_payload)

        after_snapshot: dict[str, Any] | None = None
        if tracked_model is not None and tracked_id is not None:
            after_snapshot = await _load_snapshot(tracked_model, tracked_id)
            entity_id = str(tracked_id)

        changed_fields = _compute_changed_fields(before_snapshot, after_snapshot)
        if changed_fields is None and isinstance(request_body, dict):
            changed_fields = sorted(request_body.keys())

        redacted_before = _redact(before_snapshot)
        redacted_after = _redact(after_snapshot)
        redacted_request = _redact(request_body)
        redacted_old = _redact(_select_values(before_snapshot, changed_fields))
        redacted_new = _redact(_select_values(after_snapshot, changed_fields) or redacted_request)

        audit_entry = AuditLog(
            request_id=request_id,
            user_id=user_id,
            action=request.method,
            endpoint=request.url.path,
            method=request.method,
            entity=entity,
            entity_id=entity_id,
            changed_fields=changed_fields,
            old_values=redacted_old,
            new_values=redacted_new,
            entity_snapshot_before=redacted_before,
            entity_snapshot_after=redacted_after,
            status_code=replayable_response.status_code,
            ip_address=ip_address,
            error_message=None if replayable_response.status_code < 400 else "request failed",
        )

        async with AsyncSessionLocal() as session:
            session.add(audit_entry)
            try:
                await session.commit()
            except Exception:
                await session.rollback()

        return replayable_response


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
            return {"raw_body": body.decode("utf-8", errors="ignore")[:1024]}

    # Binary and multipart payloads are intentionally not persisted.
    return {"raw_body": "<non-json-payload>"}


def _parse_entity(path: str) -> tuple[str, str | None]:
    parts = [part for part in path.split("/") if part]
    if len(parts) < 2:
        return ("unknown", None)

    if parts[1] == "customers" and len(parts) >= 4:
        if parts[3] == "locations":
            return ("customer-locations", parts[4] if len(parts) > 4 else None)
        if parts[3] == "contacts":
            return ("customer-contacts", parts[4] if len(parts) > 4 else None)

    entity = parts[1]
    entity_id = parts[2] if len(parts) > 2 else None
    return (entity, entity_id)


def _safe_int(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return None


def _extract_entity_id_from_payload(entity: str, payload: Any) -> int | None:
    if not isinstance(payload, dict):
        return None

    direct = _safe_int(payload.get("id"))
    if direct is not None:
        return direct

    nested = payload.get("wave")
    if entity == "pick-waves" and isinstance(nested, dict):
        return _safe_int(nested.get("id"))

    if entity == "sales-orders":
        nested_order = payload.get("order")
        if isinstance(nested_order, dict):
            return _safe_int(nested_order.get("id"))

    if entity == "invoices":
        nested_invoice = payload.get("invoice")
        if isinstance(nested_invoice, dict):
            return _safe_int(nested_invoice.get("id"))

    return None


async def _load_snapshot(model: type[Any], entity_id: int) -> dict[str, Any] | None:
    async with AsyncSessionLocal() as session:
        row = (await session.execute(select(model).where(model.id == entity_id))).scalar_one_or_none()
        if row is None:
            return None

        data: dict[str, Any] = {}
        mapper = sa_inspect(row.__class__)
        for column in mapper.columns:
            data[column.key] = _serialize_value(getattr(row, column.key))
        return data


def _serialize_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, dict):
        return {str(key): _serialize_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_serialize_value(item) for item in value]
    return value


def _compute_changed_fields(before: dict[str, Any] | None, after: dict[str, Any] | None) -> list[str] | None:
    if before is None or after is None:
        return None
    changed = sorted(key for key in set(before) | set(after) if before.get(key) != after.get(key))
    return changed or None


def _select_values(snapshot: dict[str, Any] | None, fields: list[str] | None) -> dict[str, Any] | None:
    if snapshot is None:
        return None
    if not fields:
        return snapshot
    return {field: snapshot.get(field) for field in fields}


async def _materialize_response(response: Response) -> tuple[bytes, Response]:
    body = b""
    if hasattr(response, "body") and response.body is not None:
        body = bytes(response.body)
    elif getattr(response, "body_iterator", None) is not None:
        async for chunk in response.body_iterator:
            body += chunk

    headers = dict(response.headers)
    headers.pop("content-length", None)
    replayable = Response(
        content=body,
        status_code=response.status_code,
        headers=headers,
        media_type=response.media_type,
    )
    return body, replayable


def _try_parse_json(body: bytes) -> Any:
    if not body:
        return None
    try:
        return json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None


def _redact(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, dict):
        out: dict[str, Any] = {}
        for key, raw in value.items():
            if key.lower() in _REDACT_KEYS:
                out[key] = "***"
            else:
                out[key] = _redact(raw)
        return out
    if isinstance(value, list):
        return [_redact(item) for item in value]
    if isinstance(value, str) and len(value) > 4000:
        return value[:4000]
    return value
