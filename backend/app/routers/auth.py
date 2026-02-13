from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.dependencies import get_current_user, get_db
from app.models.auth import User
from app.schemas.auth import AuthUser, LoginRequest, LogoutResponse, RefreshRequest, TokenResponse
from app.services.auth_service import (
    authenticate_user,
    create_token_response,
    get_user_by_id,
    to_auth_user,
)
from app.utils.security import TokenError, decode_token

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    user = await authenticate_user(db, payload.username, payload.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return create_token_response(user, settings.access_token_expire_minutes)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    try:
        token_payload = decode_token(payload.refresh_token)
    except TokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token") from exc

    if token_payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    user = await get_user_by_id(db, int(token_payload["sub"]))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive or missing")
    if user.token_version != int(token_payload.get("token_version", -1)):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token revoked")

    return create_token_response(user, settings.access_token_expire_minutes)


@router.post("/logout", response_model=LogoutResponse)
async def logout(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> LogoutResponse:
    current_user.token_version += 1
    await db.commit()
    await db.refresh(current_user)
    return LogoutResponse()


@router.get("/me", response_model=AuthUser)
async def me(current_user: User = Depends(get_current_user)) -> AuthUser:
    return to_auth_user(current_user)
