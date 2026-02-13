from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class WarehouseBase(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=255)
    address: str | None = None
    is_active: bool = True


class WarehouseCreate(WarehouseBase):
    pass


class WarehouseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    address: str | None = None
    is_active: bool | None = None


class WarehouseResponse(WarehouseBase):
    id: int
    created_at: datetime
    updated_at: datetime


class ZoneBase(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=255)
    zone_type: str = Field(
        default="storage",
        pattern="^(inbound|storage|picking|outbound|returns|blocked|quality)$",
    )
    is_active: bool = True


class ZoneCreate(ZoneBase):
    pass


class ZoneUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    zone_type: str | None = Field(
        default=None,
        pattern="^(inbound|storage|picking|outbound|returns|blocked|quality)$",
    )
    is_active: bool | None = None


class ZoneResponse(ZoneBase):
    id: int
    warehouse_id: int
    created_at: datetime
    updated_at: datetime


class BinBase(BaseModel):
    code: str = Field(min_length=1, max_length=64)
    bin_type: str = Field(
        default="storage",
        pattern="^(inbound|storage|picking|outbound|returns|blocked|quality)$",
    )
    max_weight: Decimal | None = None
    max_volume: Decimal | None = None
    qr_code_data: str | None = None
    is_active: bool = True


class BinCreate(BinBase):
    pass


class BinUpdate(BaseModel):
    bin_type: str | None = Field(
        default=None,
        pattern="^(inbound|storage|picking|outbound|returns|blocked|quality)$",
    )
    max_weight: Decimal | None = None
    max_volume: Decimal | None = None
    qr_code_data: str | None = None
    is_active: bool | None = None


class BinResponse(BinBase):
    id: int
    zone_id: int
    created_at: datetime
    updated_at: datetime


class BinBatchCreateRequest(BaseModel):
    prefix: str = Field(default="A", min_length=1, max_length=10)
    aisle_from: int = Field(default=1, ge=1)
    aisle_to: int = Field(default=1, ge=1)
    shelf_from: int = Field(default=1, ge=1)
    shelf_to: int = Field(default=1, ge=1)
    level_from: int = Field(default=1, ge=1)
    level_to: int = Field(default=1, ge=1)
    bin_type: str = Field(
        default="storage",
        pattern="^(inbound|storage|picking|outbound|returns|blocked|quality)$",
    )


class BinBatchCreateResponse(BaseModel):
    created_count: int
    items: list[BinResponse]


class BinQrPdfRequest(BaseModel):
    bin_ids: list[int] = Field(min_length=1, max_length=200)
