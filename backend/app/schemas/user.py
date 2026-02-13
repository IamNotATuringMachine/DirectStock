from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    email: EmailStr | None = None
    full_name: str | None = None
    is_active: bool = True


class UserCreate(UserBase):
    password: str = Field(min_length=8)
    roles: list[str] = Field(default_factory=list)


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = None
    is_active: bool | None = None
    roles: list[str] | None = None


class UserResponse(BaseModel):
    id: int
    username: str
    email: str | None
    full_name: str | None
    is_active: bool
    roles: list[str]
    created_at: datetime
    updated_at: datetime


class UserListResponse(BaseModel):
    items: list[UserResponse]


class MessageResponse(BaseModel):
    message: str
