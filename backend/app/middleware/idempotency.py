import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.database import AsyncSessionLocal
from app.models.purchasing import ClientOperationLog

_HEADER_NAME = "X-Client-Operation-Id"
_MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
_OFFLINE_ENDPOINT_PREFIXES = (
    "/api/goods-receipts",
    "/api/goods-issues",
    "/api/stock-transfers",
    "/api/inventory-counts",
)


class IdempotencyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        operation_id = _extract_operation_id(request)
        if operation_id is None:
            return await call_next(request)

        if not operation_id or len(operation_id) > 128:
            return _api_error(
                request,
                status_code=422,
                code="validation_error",
                message="Invalid X-Client-Operation-Id",
                details={
                    "header": _HEADER_NAME,
                    "max_length": 128,
                },
            )

        reservation_state = await _reserve_operation(request, operation_id)
        if reservation_state is not None:
            return reservation_state

        try:
            response = await call_next(request)
        except Exception:
            await _delete_operation(operation_id)
            raise

        body_bytes, replayable_response = await _materialize_response(response)
        await _finalize_operation(
            operation_id=operation_id,
            status_code=replayable_response.status_code,
            response_body=body_bytes.decode("utf-8", errors="ignore") if body_bytes else None,
        )
        return replayable_response


async def _reserve_operation(request: Request, operation_id: str) -> Response | None:
    endpoint = request.url.path
    method = request.method

    async with AsyncSessionLocal() as session:
        row = ClientOperationLog(
            operation_id=operation_id,
            endpoint=endpoint,
            method=method,
            status_code=0,
            response_body=None,
        )
        session.add(row)
        try:
            await session.commit()
            return None
        except IntegrityError:
            await session.rollback()

            existing = (
                await session.execute(
                    select(ClientOperationLog).where(ClientOperationLog.operation_id == operation_id)
                )
            ).scalar_one_or_none()
            if existing is None:
                return _api_error(
                    request,
                    status_code=409,
                    code="conflict",
                    message="Operation could not be reserved",
                    details={"operation_id": operation_id},
                )

            if existing.endpoint != endpoint or existing.method != method:
                return _api_error(
                    request,
                    status_code=409,
                    code="conflict",
                    message="Operation ID already used for different request",
                    details={
                        "operation_id": operation_id,
                        "existing_endpoint": existing.endpoint,
                        "existing_method": existing.method,
                        "request_endpoint": endpoint,
                        "request_method": method,
                    },
                )

            if existing.status_code == 0:
                return _api_error(
                    request,
                    status_code=409,
                    code="conflict",
                    message="Operation is already in progress",
                    details={"operation_id": operation_id},
                )

            return _replay_existing_response(request, existing)


async def _delete_operation(operation_id: str) -> None:
    async with AsyncSessionLocal() as session:
        row = (
            await session.execute(
                select(ClientOperationLog).where(ClientOperationLog.operation_id == operation_id)
            )
        ).scalar_one_or_none()
        if row is None:
            return
        await session.delete(row)
        await session.commit()


async def _finalize_operation(operation_id: str, *, status_code: int, response_body: str | None) -> None:
    async with AsyncSessionLocal() as session:
        row = (
            await session.execute(
                select(ClientOperationLog).where(ClientOperationLog.operation_id == operation_id)
            )
        ).scalar_one_or_none()
        if row is None:
            return

        row.status_code = status_code
        row.response_body = response_body
        await session.commit()


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


def _extract_operation_id(request: Request) -> str | None:
    if request.method not in _MUTATING_METHODS:
        return None
    if not request.url.path.startswith(_OFFLINE_ENDPOINT_PREFIXES):
        return None

    value = request.headers.get(_HEADER_NAME)
    if value is None:
        return None
    return value.strip()


def _replay_existing_response(request: Request, row: ClientOperationLog) -> Response:
    request_id = getattr(request.state, "request_id", "unknown")
    if row.response_body:
        try:
            payload = json.loads(row.response_body)
            return JSONResponse(
                status_code=row.status_code,
                content=payload,
                headers={"X-Request-ID": request_id},
            )
        except json.JSONDecodeError:
            return Response(
                content=row.response_body,
                status_code=row.status_code,
                headers={"X-Request-ID": request_id},
            )

    return Response(status_code=row.status_code, headers={"X-Request-ID": request_id})


def _api_error(
    request: Request,
    *,
    status_code: int,
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
) -> JSONResponse:
    request_id = getattr(request.state, "request_id", "unknown")
    return JSONResponse(
        status_code=status_code,
        content={
            "code": code,
            "message": message,
            "request_id": request_id,
            "details": details,
        },
        headers={"X-Request-ID": request_id},
    )
