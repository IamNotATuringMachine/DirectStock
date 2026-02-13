from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class LogoutResponse(BaseModel):
    message: str = "logged out"


class AuthUser(BaseModel):
    id: int
    username: str
    email: str | None
    roles: list[str]
    is_active: bool


class PasswordChangeRequest(BaseModel):
    current_password: str | None = None
    new_password: str = Field(min_length=8)
