from pydantic import BaseModel, Field, model_validator


class PurchaseEmailSenderProfileResponse(BaseModel):
    id: int
    profile_name: str
    is_active: bool
    smtp_enabled: bool
    smtp_host: str | None
    smtp_port: int = Field(ge=1, le=65535)
    smtp_username: str | None
    smtp_password_set: bool
    smtp_use_tls: bool
    from_address: str
    reply_to_address: str
    sender_name: str
    imap_enabled: bool
    imap_host: str | None
    imap_port: int = Field(ge=1, le=65535)
    imap_username: str | None
    imap_password_set: bool
    imap_mailbox: str
    imap_use_ssl: bool
    poll_interval_seconds: int = Field(ge=30, le=86400)
    default_to_addresses: str | None
    default_cc_addresses: str | None


class PurchaseEmailSettingsResponse(BaseModel):
    active_profile_id: int
    profiles: list[PurchaseEmailSenderProfileResponse]


class PurchaseEmailSenderProfileUpdate(BaseModel):
    id: int | None = None
    profile_name: str = Field(min_length=1, max_length=120)
    is_active: bool = False
    smtp_enabled: bool = False
    smtp_host: str | None = None
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_username: str | None = None
    smtp_password: str | None = None
    clear_smtp_password: bool = False
    smtp_use_tls: bool = True
    from_address: str = Field(min_length=1, max_length=255)
    reply_to_address: str = Field(min_length=1, max_length=255)
    sender_name: str = Field(min_length=1, max_length=255)
    imap_enabled: bool = False
    imap_host: str | None = None
    imap_port: int = Field(default=993, ge=1, le=65535)
    imap_username: str | None = None
    imap_password: str | None = None
    clear_imap_password: bool = False
    imap_mailbox: str = Field(min_length=1, max_length=255)
    imap_use_ssl: bool = True
    poll_interval_seconds: int = Field(default=300, ge=30, le=86400)
    default_to_addresses: str | None = None
    default_cc_addresses: str | None = None


class PurchaseEmailSettingsUpdate(BaseModel):
    profiles: list[PurchaseEmailSenderProfileUpdate]

    @model_validator(mode="after")
    def _validate_profiles_not_empty(self) -> "PurchaseEmailSettingsUpdate":
        if not self.profiles:
            raise ValueError("At least one sender profile is required")
        return self
