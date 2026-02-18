from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class PurchaseOrderCreate(BaseModel):
    order_number: str | None = Field(default=None, max_length=64)
    supplier_id: int | None = None
    expected_delivery_at: datetime | None = None
    notes: str | None = None


class PurchaseOrderUpdate(BaseModel):
    supplier_id: int | None = None
    expected_delivery_at: datetime | None = None
    notes: str | None = None


class PurchaseOrderStatusUpdate(BaseModel):
    status: str = Field(pattern="^(draft|approved|ordered|partially_received|completed|cancelled)$")


class PurchaseOrderResponse(BaseModel):
    id: int
    order_number: str
    supplier_id: int | None
    status: str
    expected_delivery_at: datetime | None
    ordered_at: datetime | None
    completed_at: datetime | None
    created_by: int | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class PurchaseOrderItemCreate(BaseModel):
    product_id: int
    ordered_quantity: Decimal = Field(gt=Decimal("0"))
    unit: str = Field(default="piece", min_length=1, max_length=20)
    unit_price: Decimal | None = None
    expected_delivery_at: datetime | None = None


class PurchaseOrderItemUpdate(BaseModel):
    ordered_quantity: Decimal | None = Field(default=None, gt=Decimal("0"))
    received_quantity: Decimal | None = Field(default=None, ge=Decimal("0"))
    unit: str | None = Field(default=None, min_length=1, max_length=20)
    unit_price: Decimal | None = None
    expected_delivery_at: datetime | None = None


class PurchaseOrderItemResponse(BaseModel):
    id: int
    purchase_order_id: int
    product_id: int
    ordered_quantity: Decimal
    received_quantity: Decimal
    unit: str
    unit_price: Decimal | None
    expected_delivery_at: datetime | None
    created_at: datetime
    updated_at: datetime


class PurchaseOrderResolveItem(BaseModel):
    id: int
    product_id: int
    product_number: str | None
    product_name: str | None
    ordered_quantity: Decimal
    received_quantity: Decimal
    open_quantity: Decimal
    unit: str


class PurchaseOrderResolveResponse(BaseModel):
    order: PurchaseOrderResponse
    items: list[PurchaseOrderResolveItem]
