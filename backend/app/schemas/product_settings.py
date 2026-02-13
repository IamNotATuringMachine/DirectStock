from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class ProductWarehouseSettingUpsert(BaseModel):
    ean: str | None = Field(default=None, max_length=32)
    gtin: str | None = Field(default=None, max_length=32)
    net_weight: Decimal | None = None
    gross_weight: Decimal | None = None
    length_cm: Decimal | None = None
    width_cm: Decimal | None = None
    height_cm: Decimal | None = None
    min_stock: Decimal | None = None
    reorder_point: Decimal | None = None
    max_stock: Decimal | None = None
    safety_stock: Decimal | None = None
    lead_time_days: int | None = None
    qr_code_data: str | None = Field(default=None, max_length=255)


class ProductWarehouseSettingResponse(ProductWarehouseSettingUpsert):
    id: int
    product_id: int
    warehouse_id: int
    created_at: datetime
    updated_at: datetime
