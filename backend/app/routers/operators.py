from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_permissions
from app.models.auth import User
from app.models.inventory import WarehouseOperator
from app.schemas.operators import (
    OperatorUnlockRequest,
    OperatorUnlockResponse,
    SignoffSettingsResponse,
    SignoffSettingsUpdate,
    WarehouseOperatorCreate,
    WarehouseOperatorResponse,
    WarehouseOperatorUpdate,
)
from app.schemas.user import MessageResponse
from app.services.operation_signoff_service import (
    apply_operator_pin_update,
    create_pin_session_for_operator,
    get_or_create_signoff_settings,
    normalize_operator_name,
)
from app.utils.http_status import HTTP_422_UNPROCESSABLE

router = APIRouter(prefix="/api/operators", tags=["operators"])

OPERATORS_READ_PERMISSION = "module.operators.read"
OPERATORS_WRITE_PERMISSION = "module.operators.write"
OPERATORS_SETTINGS_WRITE_PERMISSION = "module.operators.settings.write"


def _to_operator_response(item: WarehouseOperator) -> WarehouseOperatorResponse:
    return WarehouseOperatorResponse(
        id=item.id,
        display_name=item.display_name,
        is_active=item.is_active,
        pin_enabled=item.pin_enabled,
        has_pin=item.pin_hash is not None,
        created_by=item.created_by,
        updated_by=item.updated_by,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get("", response_model=list[WarehouseOperatorResponse])
async def list_operators(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(OPERATORS_READ_PERMISSION)),
) -> list[WarehouseOperatorResponse]:
    rows = list((await db.execute(select(WarehouseOperator).order_by(WarehouseOperator.display_name.asc()))).scalars())
    return [_to_operator_response(item) for item in rows]


@router.post("", response_model=WarehouseOperatorResponse, status_code=status.HTTP_201_CREATED)
async def create_operator(
    payload: WarehouseOperatorCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(OPERATORS_WRITE_PERMISSION)),
) -> WarehouseOperatorResponse:
    display_name = normalize_operator_name(payload.display_name)
    operator = WarehouseOperator(
        display_name=display_name,
        is_active=True,
        pin_hash=None,
        pin_enabled=False,
        created_by=current_user.id,
        updated_by=current_user.id,
    )

    try:
        apply_operator_pin_update(
            operator,
            pin=payload.pin,
            clear_pin=False,
            pin_enabled=payload.pin_enabled,
        )
    except HTTPException as exc:
        raise exc

    if payload.pin_enabled and payload.pin is None:
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="PIN must be set before enabling pin mode")

    db.add(operator)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Operator already exists") from exc

    await db.refresh(operator)
    return _to_operator_response(operator)


@router.put("/{operator_id}", response_model=WarehouseOperatorResponse)
async def update_operator(
    operator_id: int,
    payload: WarehouseOperatorUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(OPERATORS_WRITE_PERMISSION)),
) -> WarehouseOperatorResponse:
    operator = await db.get(WarehouseOperator, operator_id)
    if operator is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operator not found")

    if payload.display_name is not None:
        operator.display_name = normalize_operator_name(payload.display_name)
    if payload.is_active is not None:
        operator.is_active = payload.is_active

    apply_operator_pin_update(
        operator,
        pin=payload.pin,
        clear_pin=payload.clear_pin,
        pin_enabled=payload.pin_enabled,
    )

    operator.updated_by = current_user.id

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Operator update conflict") from exc

    await db.refresh(operator)
    return _to_operator_response(operator)


@router.delete("/{operator_id}", response_model=MessageResponse)
async def delete_operator(
    operator_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(OPERATORS_WRITE_PERMISSION)),
) -> MessageResponse:
    operator = await db.get(WarehouseOperator, operator_id)
    if operator is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operator not found")

    await db.delete(operator)
    await db.commit()
    return MessageResponse(message="operator deleted")


@router.post("/unlock", response_model=OperatorUnlockResponse)
async def unlock_operator_session(
    payload: OperatorUnlockRequest,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(OPERATORS_READ_PERMISSION)),
) -> OperatorUnlockResponse:
    operator, token, expires_at = await create_pin_session_for_operator(db=db, pin=payload.pin)
    return OperatorUnlockResponse(
        operator_id=operator.id,
        operator_name=operator.display_name,
        session_token=token,
        expires_at=expires_at,
    )


@router.get("/signoff-settings", response_model=SignoffSettingsResponse)
async def get_signoff_settings(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(OPERATORS_READ_PERMISSION)),
) -> SignoffSettingsResponse:
    row = await get_or_create_signoff_settings(db)
    await db.commit()
    await db.refresh(row)
    return SignoffSettingsResponse(
        require_pin=row.require_pin,
        require_operator_selection=row.require_operator_selection,
        pin_session_ttl_minutes=row.pin_session_ttl_minutes,
        updated_by=row.updated_by,
        updated_at=row.updated_at,
    )


@router.put("/signoff-settings", response_model=SignoffSettingsResponse)
async def update_signoff_settings(
    payload: SignoffSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(OPERATORS_SETTINGS_WRITE_PERMISSION)),
) -> SignoffSettingsResponse:
    row = await get_or_create_signoff_settings(db)
    row.require_pin = payload.require_pin
    row.require_operator_selection = payload.require_operator_selection
    row.pin_session_ttl_minutes = payload.pin_session_ttl_minutes
    row.updated_by = current_user.id

    await db.commit()
    await db.refresh(row)
    return SignoffSettingsResponse(
        require_pin=row.require_pin,
        require_operator_selection=row.require_operator_selection,
        pin_session_ttl_minutes=row.pin_session_ttl_minutes,
        updated_by=row.updated_by,
        updated_at=row.updated_at,
    )
