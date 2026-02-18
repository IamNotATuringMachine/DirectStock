from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.auth import Role, User, UserPermissionOverride
from app.schemas.auth import AuthUser, TokenResponse
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)


async def get_user_by_username(db: AsyncSession, username: str) -> User | None:
    stmt = (
        select(User)
        .where(User.username == username)
        .options(
            selectinload(User.roles).selectinload(Role.permissions),
            selectinload(User.permission_overrides).selectinload(UserPermissionOverride.permission),
        )
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    stmt = (
        select(User)
        .where(func.lower(User.email) == email.casefold())
        .options(
            selectinload(User.roles).selectinload(Role.permissions),
            selectinload(User.permission_overrides).selectinload(UserPermissionOverride.permission),
        )
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: int) -> User | None:
    stmt = (
        select(User)
        .where(User.id == user_id)
        .options(
            selectinload(User.roles).selectinload(Role.permissions),
            selectinload(User.permission_overrides).selectinload(UserPermissionOverride.permission),
        )
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def authenticate_user(db: AsyncSession, username: str, password: str) -> User | None:
    identifier = username.strip()
    if not identifier:
        return None

    user = await get_user_by_username(db, identifier)
    if user is None:
        user = await get_user_by_email(db, identifier)
    if not user or not user.is_active:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def _user_roles(user: User) -> list[str]:
    return sorted(role.name for role in user.roles)


def _user_permissions(user: User) -> list[str]:
    return compute_effective_permissions(user)


def compute_effective_permissions(user: User) -> list[str]:
    role_permission_codes = {permission.code for role in user.roles for permission in role.permissions}

    allow_permissions = {
        override.permission.code
        for override in user.permission_overrides
        if override.effect == "allow" and override.permission is not None
    }
    deny_permissions = {
        override.permission.code
        for override in user.permission_overrides
        if override.effect == "deny" and override.permission is not None
    }

    return sorted((role_permission_codes - deny_permissions).union(allow_permissions))


def create_token_response(user: User, access_expire_minutes: int) -> TokenResponse:
    roles = _user_roles(user)
    access_token = create_access_token(
        user_id=user.id,
        username=user.username,
        roles=roles,
        token_version=user.token_version,
    )
    refresh_token = create_refresh_token(
        user_id=user.id,
        username=user.username,
        roles=roles,
        token_version=user.token_version,
    )
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=access_expire_minutes * 60,
    )


def to_auth_user(user: User) -> AuthUser:
    return AuthUser(
        id=user.id,
        username=user.username,
        email=user.email,
        roles=_user_roles(user),
        permissions=_user_permissions(user),
        is_active=user.is_active,
    )


async def ensure_roles(db: AsyncSession, role_names: list[str]) -> list[Role]:
    if not role_names:
        return []
    stmt = select(Role).where(Role.name.in_(role_names))
    result = await db.execute(stmt)
    roles = list(result.scalars())
    role_map = {role.name for role in roles}
    missing = sorted(set(role_names) - role_map)
    if missing:
        raise ValueError(f"Unknown roles: {', '.join(missing)}")
    return roles


async def create_user(
    db: AsyncSession,
    *,
    username: str,
    email: str | None,
    full_name: str | None,
    password: str,
    role_names: list[str],
    is_active: bool,
) -> User:
    roles = await ensure_roles(db, role_names)
    user = User(
        username=username,
        email=email,
        full_name=full_name,
        hashed_password=hash_password(password),
        is_active=is_active,
        roles=roles,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user
