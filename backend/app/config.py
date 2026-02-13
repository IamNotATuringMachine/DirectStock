from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "DirectStock"
    environment: str = "development"
    cors_origins: list[str] = Field(default_factory=lambda: ["*"])

    database_url: str = "postgresql+psycopg://directstock:directstock@postgres:5432/directstock"
    async_database_url: str = (
        "postgresql+asyncpg://directstock:directstock@postgres:5432/directstock"
    )

    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    integration_access_token_expire_minutes: int = 30

    dhl_webhook_secret: str = "dhl-webhook-secret"
    dpd_webhook_secret: str = "dpd-webhook-secret"
    ups_webhook_secret: str = "ups-webhook-secret"

    default_admin_username: str = Field(
        default="admin", validation_alias="DIRECTSTOCK_ADMIN_USERNAME"
    )
    default_admin_email: str = Field(
        default="admin@directstock.local", validation_alias="DIRECTSTOCK_ADMIN_EMAIL"
    )
    default_admin_password: str = Field(
        default="DirectStock2026!", validation_alias="DIRECTSTOCK_ADMIN_PASSWORD"
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
