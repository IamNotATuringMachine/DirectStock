from datetime import datetime

from pydantic import BaseModel, Field


class SignaturePoint(BaseModel):
    x: float
    y: float
    t: int | None = None


class SignatureStroke(BaseModel):
    points: list[SignaturePoint] = Field(default_factory=list)


class SignaturePayload(BaseModel):
    strokes: list[SignatureStroke] = Field(default_factory=list)
    canvas_width: int = Field(gt=0)
    canvas_height: int = Field(gt=0)
    captured_at: datetime


class CompletionSignoffPayload(BaseModel):
    operator_id: int | None = Field(default=None, gt=0)
    signature_payload: SignaturePayload
    pin_session_token: str | None = None
    device_context: dict | None = None


class OperationSignoffSummary(BaseModel):
    operator_id: int | None
    operator_name: str
    recorded_at: datetime
    pin_verified: bool


class WarehouseOperatorCreate(BaseModel):
    display_name: str = Field(min_length=1, max_length=120)
    pin: str | None = Field(default=None, min_length=4, max_length=32)
    pin_enabled: bool = False


class WarehouseOperatorUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    is_active: bool | None = None
    pin: str | None = Field(default=None, min_length=4, max_length=32)
    clear_pin: bool = False
    pin_enabled: bool | None = None


class WarehouseOperatorResponse(BaseModel):
    id: int
    display_name: str
    is_active: bool
    pin_enabled: bool
    has_pin: bool
    created_by: int | None
    updated_by: int | None
    created_at: datetime
    updated_at: datetime


class SignoffSettingsResponse(BaseModel):
    require_pin: bool
    require_operator_selection: bool
    pin_session_ttl_minutes: int
    updated_by: int | None
    updated_at: datetime


class SignoffSettingsUpdate(BaseModel):
    require_pin: bool
    require_operator_selection: bool = True
    pin_session_ttl_minutes: int = Field(ge=5, le=24 * 60)


class OperatorUnlockRequest(BaseModel):
    pin: str = Field(min_length=4, max_length=32)


class OperatorUnlockResponse(BaseModel):
    operator_id: int
    operator_name: str
    session_token: str
    expires_at: datetime
