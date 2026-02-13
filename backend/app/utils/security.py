from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import get_settings

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class TokenError(Exception):
    pass


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def _create_token(
    *,
    user_id: int,
    username: str,
    roles: list[str],
    token_type: str,
    token_version: int,
    expires_delta: timedelta,
) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "username": username,
        "roles": roles,
        "type": token_type,
        "token_version": token_version,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
        "jti": str(uuid4()),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(*, user_id: int, username: str, roles: list[str], token_version: int) -> str:
    return _create_token(
        user_id=user_id,
        username=username,
        roles=roles,
        token_type="access",
        token_version=token_version,
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )


def create_refresh_token(*, user_id: int, username: str, roles: list[str], token_version: int) -> str:
    return _create_token(
        user_id=user_id,
        username=username,
        roles=roles,
        token_type="refresh",
        token_version=token_version,
        expires_delta=timedelta(days=settings.refresh_token_expire_days),
    )


def create_integration_access_token(*, client_id: str, scopes: list[str], expires_minutes: int | None = None) -> str:
    now = datetime.now(UTC)
    ttl_minutes = expires_minutes or settings.integration_access_token_expire_minutes
    payload: dict[str, Any] = {
        "sub": f"integration:{client_id}",
        "type": "integration_access",
        "token_version": 0,
        "client_id": client_id,
        "scopes": scopes,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=ttl_minutes)).timestamp()),
        "jti": str(uuid4()),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise TokenError("invalid_token") from exc

    required = {"sub", "type", "token_version"}
    if not required.issubset(payload):
        raise TokenError("malformed_token")
    return payload
