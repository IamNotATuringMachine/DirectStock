from datetime import UTC, datetime
from secrets import token_urlsafe

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_admin
from app.models.auth import User
from app.models.phase4 import IntegrationClient
from app.schemas.phase4 import (
    IntegrationClientCreate,
    IntegrationClientResponse,
    IntegrationClientRotateSecretResponse,
    IntegrationClientSecretResponse,
    IntegrationClientUpdate,
)
from app.schemas.user import MessageResponse
from app.utils.security import hash_password

router = APIRouter(prefix="/api/integration-clients", tags=["integration-clients"])


VALID_SCOPES = {
    "products:read",
    "warehouses:read",
    "inventory:read",
    "movements:read",
    "shipments:read",
    "orders:write",
}


def _now() -> datetime:
    return datetime.now(UTC)


def _new_secret() -> str:
    return token_urlsafe(36)


def _to_response(item: IntegrationClient) -> IntegrationClientResponse:
    return IntegrationClientResponse(
        id=item.id,
        name=item.name,
        client_id=item.client_id,
        scopes=list(item.scopes_json or []),
        token_ttl_minutes=item.token_ttl_minutes,
        is_active=item.is_active,
        last_used_at=item.last_used_at,
        secret_rotated_at=item.secret_rotated_at,
        created_by=item.created_by,
        notes=item.notes,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _validate_scopes(scopes: list[str]) -> list[str]:
    normalized = sorted({scope.strip() for scope in scopes if scope and scope.strip()})
    invalid = [scope for scope in normalized if scope not in VALID_SCOPES]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported scopes: {', '.join(invalid)}",
        )
    return normalized


@router.get("", response_model=list[IntegrationClientResponse], dependencies=[Depends(require_admin)])
async def list_integration_clients(db: AsyncSession = Depends(get_db)) -> list[IntegrationClientResponse]:
    rows = list((await db.execute(select(IntegrationClient).order_by(IntegrationClient.id.desc()))).scalars())
    return [_to_response(item) for item in rows]


@router.post("", response_model=IntegrationClientSecretResponse, status_code=status.HTTP_201_CREATED)
async def create_integration_client(
    payload: IntegrationClientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> IntegrationClientSecretResponse:
    existing = (
        await db.execute(
            select(IntegrationClient).where(
                (IntegrationClient.client_id == payload.client_id) | (IntegrationClient.name == payload.name)
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Integration client already exists")

    secret = _new_secret()
    item = IntegrationClient(
        name=payload.name,
        client_id=payload.client_id,
        secret_hash=hash_password(secret),
        scopes_json=_validate_scopes(payload.scopes),
        token_ttl_minutes=payload.token_ttl_minutes,
        is_active=payload.is_active,
        created_by=current_user.id,
        notes=payload.notes,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return IntegrationClientSecretResponse(client=_to_response(item), client_secret=secret)


@router.get("/{client_id}", response_model=IntegrationClientResponse, dependencies=[Depends(require_admin)])
async def get_integration_client(client_id: int, db: AsyncSession = Depends(get_db)) -> IntegrationClientResponse:
    item = (await db.execute(select(IntegrationClient).where(IntegrationClient.id == client_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Integration client not found")
    return _to_response(item)


@router.put("/{client_id}", response_model=IntegrationClientResponse)
async def update_integration_client(
    client_id: int,
    payload: IntegrationClientUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
) -> IntegrationClientResponse:
    item = (await db.execute(select(IntegrationClient).where(IntegrationClient.id == client_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Integration client not found")

    if payload.name is not None:
        item.name = payload.name
    if payload.scopes is not None:
        item.scopes_json = _validate_scopes(payload.scopes)
    if payload.token_ttl_minutes is not None:
        item.token_ttl_minutes = payload.token_ttl_minutes
    if payload.is_active is not None:
        item.is_active = payload.is_active
    if payload.notes is not None:
        item.notes = payload.notes

    await db.commit()
    await db.refresh(item)
    return _to_response(item)


@router.post("/{client_id}/rotate-secret", response_model=IntegrationClientRotateSecretResponse)
async def rotate_integration_client_secret(
    client_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
) -> IntegrationClientRotateSecretResponse:
    item = (await db.execute(select(IntegrationClient).where(IntegrationClient.id == client_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Integration client not found")

    secret = _new_secret()
    rotated_at = _now()
    item.secret_hash = hash_password(secret)
    item.secret_rotated_at = rotated_at

    await db.commit()
    return IntegrationClientRotateSecretResponse(
        client_id=item.client_id,
        client_secret=secret,
        rotated_at=rotated_at,
    )


@router.delete("/{client_id}", response_model=MessageResponse)
async def delete_integration_client(
    client_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
) -> MessageResponse:
    item = (await db.execute(select(IntegrationClient).where(IntegrationClient.id == client_id))).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Integration client not found")

    await db.delete(item)
    await db.commit()
    return MessageResponse(message="integration client deleted")
