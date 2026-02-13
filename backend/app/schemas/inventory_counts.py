from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class InventoryCountSessionCreate(BaseModel):
    session_number: str | None = Field(default=None, max_length=64)
    session_type: Literal["snapshot", "cycle"] = "snapshot"
    warehouse_id: int | None = None
    tolerance_quantity: Decimal = Field(default=Decimal("0"), ge=Decimal("0"))
    notes: str | None = None


class InventoryCountSessionResponse(BaseModel):
    id: int
    session_number: str
    session_type: str
    status: str
    warehouse_id: int | None
    tolerance_quantity: Decimal
    generated_at: datetime | None
    completed_at: datetime | None
    created_by: int | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class InventoryCountGenerateItemsRequest(BaseModel):
    refresh_existing: bool = False


class InventoryCountItemCountUpdate(BaseModel):
    counted_quantity: Decimal = Field(ge=Decimal("0"))


class InventoryCountItemResponse(BaseModel):
    id: int
    session_id: int
    inventory_id: int | None
    product_id: int
    product_number: str
    product_name: str
    bin_location_id: int
    bin_code: str
    snapshot_quantity: Decimal
    counted_quantity: Decimal | None
    difference_quantity: Decimal | None
    unit: str
    count_attempts: int
    recount_required: bool
    last_counted_at: datetime | None
    counted_by: int | None
    created_at: datetime
    updated_at: datetime
