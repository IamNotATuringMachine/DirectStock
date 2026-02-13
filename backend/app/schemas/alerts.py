from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field

AlertRuleType = Literal["low_stock", "zero_stock", "expiry_window"]
AlertSeverity = Literal["low", "medium", "high", "critical"]
AlertStatus = Literal["open", "acknowledged"]


class AlertRuleBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    rule_type: AlertRuleType
    severity: AlertSeverity = "medium"
    is_active: bool = True
    product_id: int | None = None
    warehouse_id: int | None = None
    threshold_quantity: Decimal | None = None
    expiry_days: int | None = Field(default=None, ge=1, le=3650)
    dedupe_window_minutes: int = Field(default=1440, ge=1, le=525600)
    metadata_json: dict[str, Any] | None = None


class AlertRuleCreate(AlertRuleBase):
    pass


class AlertRuleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    severity: AlertSeverity | None = None
    is_active: bool | None = None
    product_id: int | None = None
    warehouse_id: int | None = None
    threshold_quantity: Decimal | None = None
    expiry_days: int | None = Field(default=None, ge=1, le=3650)
    dedupe_window_minutes: int | None = Field(default=None, ge=1, le=525600)
    metadata_json: dict[str, Any] | None = None


class AlertRuleResponse(AlertRuleBase):
    id: int
    created_at: datetime
    updated_at: datetime


class AlertRuleListResponse(BaseModel):
    items: list[AlertRuleResponse]
    total: int
    page: int
    page_size: int


class AlertEventResponse(BaseModel):
    id: int
    rule_id: int | None
    alert_type: str
    severity: str
    status: AlertStatus
    title: str
    message: str
    source_key: str
    product_id: int | None
    warehouse_id: int | None
    bin_location_id: int | None
    batch_id: int | None
    triggered_at: datetime
    acknowledged_at: datetime | None
    acknowledged_by: int | None
    metadata_json: dict[str, Any] | None
    created_at: datetime
    updated_at: datetime


class AlertListResponse(BaseModel):
    items: list[AlertEventResponse]
    total: int
    page: int
    page_size: int
