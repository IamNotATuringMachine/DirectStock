from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "DirectStock"
    environment: str = "development"
    cors_origins: list[str] = Field(default_factory=lambda: ["*"])
    cors_allow_credentials: bool = False

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
    dhl_express_webhook_secret: str = "dhl-express-webhook-secret"
    dpd_webhook_secret: str = "dpd-webhook-secret"
    ups_webhook_secret: str = "ups-webhook-secret"
    dhl_express_api_base_url: str = "https://express.api.dhl.com/mydhlapi/test"
    dhl_express_api_username: str = ""
    dhl_express_api_password: str = ""
    dhl_express_api_version: str = "3.2.0"
    dhl_express_timeout_seconds: int = 20
    dhl_express_account_number: str = ""
    dhl_express_product_code: str = "P"
    dhl_express_incoterm: str = "DAP"
    dhl_express_label_template_name: str = "ECOM26_84_001"
    dhl_express_shipper_company_name: str = "DirectStock"
    dhl_express_shipper_contact_name: str = "Versand Team"
    dhl_express_shipper_email: str = ""
    dhl_express_shipper_phone: str = "+4900000000"
    dhl_express_shipper_address_line1: str = "Musterstrasse 1"
    dhl_express_shipper_address_line2: str = ""
    dhl_express_shipper_postal_code: str = "56068"
    dhl_express_shipper_city: str = "Koblenz"
    dhl_express_shipper_country_code: str = "DE"
    dhl_express_shipper_state_code: str = ""

    default_admin_username: str = Field(
        default="admin", validation_alias="DIRECTSTOCK_ADMIN_USERNAME"
    )
    default_admin_email: str = Field(
        default="admin@directstock.local", validation_alias="DIRECTSTOCK_ADMIN_EMAIL"
    )
    default_admin_password: str = Field(
        default="change-me-admin-password", validation_alias="DIRECTSTOCK_ADMIN_PASSWORD"
    )

    @model_validator(mode="after")
    def _validate_security_defaults(self) -> "Settings":
        if self.cors_allow_credentials and "*" in self.cors_origins:
            raise ValueError("CORS wildcard '*' is not allowed when CORS_ALLOW_CREDENTIALS=true")

        environment = self.environment.strip().lower()
        if environment not in {"production", "prod"}:
            return self

        insecure_defaults: list[str] = []
        if self.jwt_secret_key in {"change-me", "change-me-in-production"}:
            insecure_defaults.append("JWT_SECRET_KEY")
        if self.dhl_webhook_secret == "dhl-webhook-secret":
            insecure_defaults.append("DHL_WEBHOOK_SECRET")
        if self.dhl_express_webhook_secret == "dhl-express-webhook-secret":
            insecure_defaults.append("DHL_EXPRESS_WEBHOOK_SECRET")
        if self.dpd_webhook_secret == "dpd-webhook-secret":
            insecure_defaults.append("DPD_WEBHOOK_SECRET")
        if self.ups_webhook_secret == "ups-webhook-secret":
            insecure_defaults.append("UPS_WEBHOOK_SECRET")
        if self.default_admin_password in {"DirectStock2026!", "change-me-admin-password"}:
            insecure_defaults.append("DIRECTSTOCK_ADMIN_PASSWORD")

        if insecure_defaults:
            joined = ", ".join(insecure_defaults)
            raise ValueError(f"Insecure production defaults detected for: {joined}")

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
