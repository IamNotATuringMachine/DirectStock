from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, model_validator
from pydantic_core import PydanticCustomError


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


PermissionOverrideEffect = Literal["allow", "deny"]


class UserAccessProfileResponse(BaseModel):
    user_id: int
    username: str
    roles: list[str]
    allow_permissions: list[str] = Field(default_factory=list)
    deny_permissions: list[str] = Field(default_factory=list)
    effective_permissions: list[str] = Field(default_factory=list)


class UserAccessProfileUpdate(BaseModel):
    roles: list[str] = Field(default_factory=list)
    allow_permissions: list[str] = Field(default_factory=list)
    deny_permissions: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate_disjoint_permission_sets(self) -> "UserAccessProfileUpdate":
        overlap = sorted(set(self.allow_permissions).intersection(self.deny_permissions))
        if overlap:
            raise PydanticCustomError(
                "permission_overlap",
                "Permissions cannot exist in both allow and deny: {permissions}",
                {"permissions": ", ".join(overlap)},
            )
        return self


class MessageResponse(BaseModel):
    message: str
