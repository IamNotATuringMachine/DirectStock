from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_db, require_permissions
from app.models.auth import Permission, Role
from app.schemas.phase5 import RoleCreate, RolePermissionUpdate, RoleResponse, RoleUpdate

router = APIRouter(prefix="/api/roles", tags=["roles"])


SYSTEM_ROLES = {
    "admin",
    "lagerleiter",
    "lagermitarbeiter",
    "einkauf",
    "versand",
    "controller",
    "auditor",
    "tablet_ops",
}


def _to_response(role: Role) -> RoleResponse:
    return RoleResponse(
        id=role.id,
        name=role.name,
        description=role.description,
        permissions=sorted(permission.code for permission in role.permissions),
    )


async def _resolve_permissions(db: AsyncSession, codes: list[str]) -> list[Permission]:
    if not codes:
        return []
    rows = list((await db.execute(select(Permission).where(Permission.code.in_(codes)))).scalars())
    found = {row.code for row in rows}
    missing = sorted(set(codes) - found)
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown permission codes: {', '.join(missing)}",
        )
    return rows


@router.get("", response_model=list[RoleResponse])
async def list_roles(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions("module.roles.read")),
) -> list[RoleResponse]:
    rows = list((await db.execute(select(Role).options(selectinload(Role.permissions)).order_by(Role.name.asc()))).scalars())
    return [_to_response(row) for row in rows]


@router.post("", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    payload: RoleCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions("module.roles.manage")),
) -> RoleResponse:
    role = Role(name=payload.name.strip().lower(), description=payload.description)
    role.permissions = await _resolve_permissions(db, payload.permission_codes)
    db.add(role)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Role already exists") from exc

    await db.refresh(role)
    role = (
        await db.execute(select(Role).where(Role.id == role.id).options(selectinload(Role.permissions)))
    ).scalar_one()
    return _to_response(role)


@router.put("/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: int,
    payload: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions("module.roles.manage")),
) -> RoleResponse:
    role = (
        await db.execute(select(Role).where(Role.id == role_id).options(selectinload(Role.permissions)))
    ).scalar_one_or_none()
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

    if payload.name is not None:
        role.name = payload.name.strip().lower()
    if payload.description is not None:
        role.description = payload.description

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Role update conflict") from exc

    await db.refresh(role)
    role = (
        await db.execute(select(Role).where(Role.id == role.id).options(selectinload(Role.permissions)))
    ).scalar_one()
    return _to_response(role)


@router.delete("/{role_id}")
async def delete_role(
    role_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions("module.roles.manage")),
) -> dict[str, str]:
    role = (await db.execute(select(Role).where(Role.id == role_id))).scalar_one_or_none()
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    if role.name in SYSTEM_ROLES:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="System role cannot be deleted")

    await db.delete(role)
    await db.commit()
    return {"message": "role deleted"}


@router.put("/{role_id}/permissions", response_model=RoleResponse)
async def update_role_permissions(
    role_id: int,
    payload: RolePermissionUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions("module.roles.manage")),
) -> RoleResponse:
    role = (
        await db.execute(select(Role).where(Role.id == role_id).options(selectinload(Role.permissions)))
    ).scalar_one_or_none()
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

    role.permissions = await _resolve_permissions(db, payload.permission_codes)
    await db.commit()
    await db.refresh(role)

    role = (
        await db.execute(select(Role).where(Role.id == role.id).options(selectinload(Role.permissions)))
    ).scalar_one()
    return _to_response(role)
