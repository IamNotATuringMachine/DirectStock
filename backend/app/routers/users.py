from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_db, require_admin
from app.models.auth import User
from app.schemas.auth import PasswordChangeRequest
from app.schemas.user import MessageResponse, UserCreate, UserListResponse, UserResponse, UserUpdate
from app.services.auth_service import create_user, ensure_roles
from app.utils.security import hash_password, verify_password

router = APIRouter(prefix="/api/users", tags=["users"])


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


@router.get("", response_model=UserListResponse, dependencies=[Depends(require_admin)])
async def list_users(db: AsyncSession = Depends(get_db)) -> UserListResponse:
    stmt = select(User).options(selectinload(User.roles)).order_by(User.id.asc())
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
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already exists") from exc

    stmt = select(User).where(User.id == user.id).options(selectinload(User.roles))
    result = await db.execute(stmt)
    return _to_response(result.scalar_one())


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
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

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
