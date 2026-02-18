from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.dependencies import get_db, require_admin
from app.models.auth import Permission, Role, User, UserPermissionOverride
from app.schemas.auth import PasswordChangeRequest
from app.schemas.user import (
    MessageResponse,
    UserAccessProfileResponse,
    UserAccessProfileUpdate,
    UserCreate,
    UserListResponse,
    UserResponse,
    UserUpdate,
)
from app.services.auth_service import compute_effective_permissions, create_user, ensure_roles
from app.utils.http_status import HTTP_422_UNPROCESSABLE
from app.utils.security import hash_password, verify_password

router = APIRouter(prefix="/api/users", tags=["users"])
settings = get_settings()
SYSTEM_SEED_USERNAMES = {"lagerleiter", "lagermitarbeiter"}


def _to_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        roles=sorted(role.name for role in user.roles),
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def _managed_system_usernames() -> set[str]:
    return {settings.default_admin_username, *SYSTEM_SEED_USERNAMES}


def _to_access_profile_response(user: User) -> UserAccessProfileResponse:
    allow_permissions = sorted(
        {
            row.permission.code
            for row in user.permission_overrides
            if row.effect == "allow" and row.permission is not None
        }
    )
    deny_permissions = sorted(
        {
            row.permission.code
            for row in user.permission_overrides
            if row.effect == "deny" and row.permission is not None
        }
    )
    return UserAccessProfileResponse(
        user_id=user.id,
        username=user.username,
        roles=sorted(role.name for role in user.roles),
        allow_permissions=allow_permissions,
        deny_permissions=deny_permissions,
        effective_permissions=compute_effective_permissions(user),
    )


async def _load_user_with_access_profile(db: AsyncSession, user_id: int) -> User | None:
    stmt = (
        select(User)
        .where(User.id == user_id)
        .execution_options(populate_existing=True)
        .options(
            selectinload(User.roles).selectinload(Role.permissions),
            selectinload(User.permission_overrides).selectinload(UserPermissionOverride.permission),
        )
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


@router.get("", response_model=UserListResponse, dependencies=[Depends(require_admin)])
async def list_users(
    managed_only: bool = False,
    db: AsyncSession = Depends(get_db),
) -> UserListResponse:
    stmt = select(User).options(selectinload(User.roles)).order_by(User.id.asc())
    if managed_only:
        stmt = stmt.where(~User.username.in_(_managed_system_usernames()))
    result = await db.execute(stmt)
    users = list(result.scalars())
    return UserListResponse(items=[_to_response(user) for user in users])


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
async def create_user_endpoint(payload: UserCreate, db: AsyncSession = Depends(get_db)) -> UserResponse:
    try:
        user = await create_user(
            db,
            username=payload.username,
            email=payload.email,
            full_name=payload.full_name,
            password=payload.password,
            role_names=payload.roles,
            is_active=payload.is_active,
        )
        await db.commit()
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail=str(exc)) from exc
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already exists") from exc

    stmt = select(User).where(User.id == user.id).options(selectinload(User.roles))
    result = await db.execute(stmt)
    return _to_response(result.scalar_one())


@router.get("/{user_id}/access-profile", response_model=UserAccessProfileResponse, dependencies=[Depends(require_admin)])
async def get_user_access_profile(user_id: int, db: AsyncSession = Depends(get_db)) -> UserAccessProfileResponse:
    user = await _load_user_with_access_profile(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _to_access_profile_response(user)


@router.put("/{user_id}/access-profile", response_model=UserAccessProfileResponse, dependencies=[Depends(require_admin)])
async def update_user_access_profile(
    user_id: int,
    payload: UserAccessProfileUpdate,
    db: AsyncSession = Depends(get_db),
) -> UserAccessProfileResponse:
    user = await _load_user_with_access_profile(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    try:
        user.roles = await ensure_roles(db, payload.roles)
    except ValueError as exc:
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail=str(exc)) from exc

    requested_codes = sorted(set(payload.allow_permissions + payload.deny_permissions))
    permission_map: dict[str, Permission] = {}
    if requested_codes:
        permissions = list(
            (
                await db.execute(
                    select(Permission).where(Permission.code.in_(requested_codes))
                )
            ).scalars()
        )
        permission_map = {permission.code: permission for permission in permissions}
        missing = sorted(set(requested_codes) - set(permission_map))
        if missing:
            raise HTTPException(
                status_code=HTTP_422_UNPROCESSABLE,
                detail=f"Unknown permission codes: {', '.join(missing)}",
            )

    await db.execute(delete(UserPermissionOverride).where(UserPermissionOverride.user_id == user.id))
    for code in sorted(set(payload.allow_permissions)):
        db.add(
            UserPermissionOverride(
                user_id=user.id,
                permission_id=permission_map[code].id,
                effect="allow",
            )
        )
    for code in sorted(set(payload.deny_permissions)):
        db.add(
            UserPermissionOverride(
                user_id=user.id,
                permission_id=permission_map[code].id,
                effect="deny",
            )
        )

    await db.commit()
    user = await _load_user_with_access_profile(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _to_access_profile_response(user)


@router.put("/{user_id}", response_model=UserResponse, dependencies=[Depends(require_admin)])
async def update_user_endpoint(user_id: int, payload: UserUpdate, db: AsyncSession = Depends(get_db)) -> UserResponse:
    stmt = select(User).where(User.id == user_id).options(selectinload(User.roles))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if payload.email is not None:
        user.email = payload.email
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.roles is not None:
        try:
            user.roles = await ensure_roles(db, payload.roles)
        except ValueError as exc:
            raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail=str(exc)) from exc

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Conflict while updating user") from exc

    await db.refresh(user)
    stmt = select(User).where(User.id == user.id).options(selectinload(User.roles))
    result = await db.execute(stmt)
    return _to_response(result.scalar_one())


@router.patch("/{user_id}/password", response_model=MessageResponse, dependencies=[Depends(require_admin)])
async def change_password_endpoint(
    user_id: int, payload: PasswordChangeRequest, db: AsyncSession = Depends(get_db)
) -> MessageResponse:
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if payload.current_password and not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password invalid")

    user.hashed_password = hash_password(payload.new_password)
    user.token_version += 1
    await db.commit()
    return MessageResponse(message="password changed")


@router.delete("/{user_id}", response_model=MessageResponse, dependencies=[Depends(require_admin)])
async def delete_user_endpoint(user_id: int, db: AsyncSession = Depends(get_db)) -> MessageResponse:
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    await db.delete(user)
    await db.commit()
    return MessageResponse(message="user deleted")
