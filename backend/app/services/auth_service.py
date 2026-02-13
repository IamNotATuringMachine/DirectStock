from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.auth import Role, User
from app.schemas.auth import AuthUser, TokenResponse
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)


async def get_user_by_username(db: AsyncSession, username: str) -> User | None:
    stmt = select(User).where(User.username == username).options(selectinload(User.roles))
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: int) -> User | None:
    stmt = select(User).where(User.id == user_id).options(selectinload(User.roles))
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def authenticate_user(db: AsyncSession, username: str, password: str) -> User | None:
    user = await get_user_by_username(db, username)
    if not user or not user.is_active:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def _user_roles(user: User) -> list[str]:
    return sorted(role.name for role in user.roles)


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
