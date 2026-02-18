from collections.abc import AsyncGenerator, Callable
from dataclasses import dataclass
from datetime import UTC, datetime

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db_session
from app.models.auth import Role, User, UserPermissionOverride
from app.models.phase4 import IntegrationClient
from app.services.auth_service import compute_effective_permissions
from app.utils.security import TokenError, decode_token

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(slots=True)
class IntegrationAuthContext:
    client: IntegrationClient
    scopes: set[str]
    token_payload: dict


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async for session in get_db_session():
        yield session


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    token = credentials.credentials
    try:
        payload = decode_token(token)
    except TokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    user_id = int(payload["sub"])
    stmt = (
        select(User)
        .where(User.id == user_id)
        .options(
            selectinload(User.roles).selectinload(Role.permissions),
            selectinload(User.permission_overrides).selectinload(UserPermissionOverride.permission),
        )
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive or missing")
    if user.token_version != int(payload.get("token_version", -1)):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token revoked")

    request.state.user_id = user.id
    request.state.role_names = [role.name for role in user.roles]
    request.state.permission_codes = sorted(
        compute_effective_permissions(user)
    )
    return user


def require_roles(*allowed_roles: str) -> Callable:
    async def _require(current_user: User = Depends(get_current_user)) -> User:
        role_names = {role.name for role in current_user.roles}
        if not role_names.intersection(allowed_roles):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Missing required role")
        return current_user

    return _require


def require_permissions(*required_permissions: str) -> Callable:
    async def _require(current_user: User = Depends(get_current_user)) -> User:
        permission_codes = set(compute_effective_permissions(current_user))
        missing = [code for code in required_permissions if code not in permission_codes]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permission(s): {', '.join(missing)}",
            )
        return current_user

    return _require


require_admin = require_roles("admin")


async def get_integration_auth_context(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> IntegrationAuthContext:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        payload = decode_token(credentials.credentials)
    except TokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    if payload.get("type") != "integration_access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid integration token type")

    client_id = payload.get("client_id")
    if not isinstance(client_id, str) or not client_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid integration token")

    client = (
        await db.execute(
            select(IntegrationClient).where(IntegrationClient.client_id == client_id)
        )
    ).scalar_one_or_none()
    if client is None or not client.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Integration client inactive or missing")

    token_scopes_raw = payload.get("scopes") or []
    if not isinstance(token_scopes_raw, list):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token scopes")
    token_scopes = {str(scope) for scope in token_scopes_raw}
    allowed_scopes = {str(scope) for scope in (client.scopes_json or [])}
    effective_scopes = token_scopes.intersection(allowed_scopes)

    client.last_used_at = datetime.now(UTC)
    await db.commit()

    request.state.integration_client_id = client.id
    request.state.integration_client_name = client.name
    return IntegrationAuthContext(client=client, scopes=effective_scopes, token_payload=payload)


def require_integration_scopes(*required_scopes: str) -> Callable:
    async def _require(context: IntegrationAuthContext = Depends(get_integration_auth_context)) -> IntegrationAuthContext:
        missing = [scope for scope in required_scopes if scope not in context.scopes]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required integration scopes: {', '.join(missing)}",
            )
        return context

    return _require
