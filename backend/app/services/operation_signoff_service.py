from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, status
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.auth import User
from app.models.inventory import OperationSignoff, OperationSignoffSetting, WarehouseOperator
from app.schemas.operators import CompletionSignoffPayload, OperationSignoffSummary
from app.utils.http_status import HTTP_422_UNPROCESSABLE
from app.utils.security import hash_password, verify_password

settings = get_settings()

SIGNOFF_REQUIRED_ROLE = "tablet_ops"
SIGNOFF_REQUIRED_PERMISSION = "module.operations.signoff.required"
PIN_SESSION_TOKEN_TYPE = "operator_pin_session"
UNASSIGNED_OPERATOR_SNAPSHOT = "Nicht ausgewählt"


def _now() -> datetime:
    return datetime.now(UTC)


def _effective_permissions(current_user: User) -> set[str]:
    return {
        permission.code
        for role in current_user.roles
        for permission in role.permissions
    }


def is_signoff_required_for_user(current_user: User) -> bool:
    role_names = {role.name for role in current_user.roles}
    if SIGNOFF_REQUIRED_ROLE in role_names:
        return True

    permission_codes = _effective_permissions(current_user)
    return SIGNOFF_REQUIRED_PERMISSION in permission_codes or "*" in permission_codes


async def get_or_create_signoff_settings(db: AsyncSession) -> OperationSignoffSetting:
    row = await db.get(OperationSignoffSetting, 1)
    if row is None:
        row = OperationSignoffSetting(
            id=1,
            require_pin=False,
            require_operator_selection=True,
            pin_session_ttl_minutes=480,
            updated_by=None,
        )
        db.add(row)
        await db.flush()
    return row


def normalize_operator_name(raw: str) -> str:
    normalized = raw.strip()
    if not normalized:
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="display_name must not be empty")
    return normalized


def _decode_pin_session_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="PIN session invalid or expired") from exc

    if payload.get("type") != PIN_SESSION_TOKEN_TYPE:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="PIN session invalid or expired")
    if not isinstance(payload.get("operator_id"), int):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="PIN session invalid or expired")
    if not isinstance(payload.get("jti"), str):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="PIN session invalid or expired")
    return payload


async def create_pin_session_for_operator(
    *,
    db: AsyncSession,
    pin: str,
) -> tuple[WarehouseOperator, str, datetime]:
    rows = list(
        (
            await db.execute(
                select(WarehouseOperator).where(
                    WarehouseOperator.is_active.is_(True),
                    WarehouseOperator.pin_enabled.is_(True),
                    WarehouseOperator.pin_hash.is_not(None),
                )
            )
        ).scalars()
    )

    operator = next(
        (
            item
            for item in rows
            if item.pin_hash is not None and verify_password(pin, item.pin_hash)
        ),
        None,
    )
    if operator is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="PIN invalid")

    signoff_settings = await get_or_create_signoff_settings(db)
    now = _now()
    expires_at = now + timedelta(minutes=int(signoff_settings.pin_session_ttl_minutes))
    token_payload = {
        "sub": f"warehouse_operator:{operator.id}",
        "type": PIN_SESSION_TOKEN_TYPE,
        "operator_id": operator.id,
        "operator_name": operator.display_name,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
        "jti": str(uuid4()),
    }
    token = jwt.encode(token_payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return operator, token, expires_at


async def build_operation_signoff(
    *,
    db: AsyncSession,
    payload: CompletionSignoffPayload | None,
    current_user: User,
    operation_type: str,
    operation_id: int,
) -> OperationSignoff | None:
    signoff_required = is_signoff_required_for_user(current_user)
    if payload is None:
        if signoff_required:
            raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="signoff payload is required")
        return None

    if not payload.signature_payload.strokes or not any(stroke.points for stroke in payload.signature_payload.strokes):
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="signature payload must contain strokes")

    signoff_settings = await get_or_create_signoff_settings(db)
    require_operator_selection = bool(signoff_settings.require_operator_selection)

    operator: WarehouseOperator | None = None
    if payload.operator_id is not None:
        operator = await db.get(WarehouseOperator, payload.operator_id)
        if operator is None or not operator.is_active:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse operator not found")
    elif require_operator_selection:
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="operator_id is required")

    pin_verified = False
    pin_session_token_id: str | None = None
    if signoff_settings.require_pin:
        if payload.pin_session_token is None:
            raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="pin_session_token is required")

        token_payload = _decode_pin_session_token(payload.pin_session_token)
        token_operator = await db.get(WarehouseOperator, int(token_payload["operator_id"]))
        if token_operator is None or not token_operator.is_active:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="PIN session invalid or expired")
        if not token_operator.pin_enabled or token_operator.pin_hash is None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="PIN session invalid or expired")

        if operator is None:
            operator = token_operator
        elif token_payload["operator_id"] != operator.id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="PIN session invalid or expired")
        pin_verified = True
        pin_session_token_id = token_payload["jti"]

    operator_id = operator.id if operator is not None else None
    operator_name_snapshot = operator.display_name if operator is not None else UNASSIGNED_OPERATOR_SNAPSHOT

    return OperationSignoff(
        operation_type=operation_type,
        operation_id=operation_id,
        operator_id=operator_id,
        operator_name_snapshot=operator_name_snapshot,
        signature_payload_json=payload.signature_payload.model_dump(mode="json"),
        pin_verified=pin_verified,
        pin_session_token_id=pin_session_token_id,
        device_context_json=payload.device_context,
        recorded_by_user_id=current_user.id,
    )


async def fetch_operation_signoff_map(
    *,
    db: AsyncSession,
    operation_type: str,
    operation_ids: list[int],
) -> dict[int, OperationSignoffSummary]:
    if not operation_ids:
        return {}

    rows = list(
        (
            await db.execute(
                select(OperationSignoff).where(
                    OperationSignoff.operation_type == operation_type,
                    OperationSignoff.operation_id.in_(operation_ids),
                )
            )
        ).scalars()
    )
    return {
        row.operation_id: OperationSignoffSummary(
            operator_id=row.operator_id,
            operator_name=row.operator_name_snapshot,
            recorded_at=row.recorded_at,
            pin_verified=row.pin_verified,
        )
        for row in rows
    }


async def fetch_operation_signoff_summary(
    *,
    db: AsyncSession,
    operation_type: str,
    operation_id: int,
) -> OperationSignoffSummary | None:
    row = (
        await db.execute(
            select(OperationSignoff).where(
                OperationSignoff.operation_type == operation_type,
                OperationSignoff.operation_id == operation_id,
            )
        )
    ).scalar_one_or_none()
    if row is None:
        return None

    return OperationSignoffSummary(
        operator_id=row.operator_id,
        operator_name=row.operator_name_snapshot,
        recorded_at=row.recorded_at,
        pin_verified=row.pin_verified,
    )


def apply_operator_pin_update(operator: WarehouseOperator, *, pin: str | None, clear_pin: bool, pin_enabled: bool | None) -> None:
    if clear_pin:
        operator.pin_hash = None
        operator.pin_enabled = False if pin_enabled is None else pin_enabled
        return

    if pin is not None:
        operator.pin_hash = hash_password(pin)
        operator.pin_enabled = True if pin_enabled is None else pin_enabled
        return

    if pin_enabled is not None:
        if pin_enabled and operator.pin_hash is None:
            raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="PIN must be set before enabling pin mode")
        operator.pin_enabled = pin_enabled
