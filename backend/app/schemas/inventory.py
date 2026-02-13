from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class InventoryItem(BaseModel):
    product_id: int
    product_number: str
    product_name: str
    total_quantity: Decimal
    reserved_quantity: Decimal
    available_quantity: Decimal
    unit: str


class InventoryListResponse(BaseModel):
    items: list[InventoryItem]
    total: int
    page: int
    page_size: int


class InventoryByProductItem(BaseModel):
    inventory_id: int
    warehouse_id: int
    warehouse_code: str
    zone_id: int
    zone_code: str
    bin_id: int
    bin_code: str
    quantity: Decimal
    reserved_quantity: Decimal
    available_quantity: Decimal
    unit: str


class InventoryByBinItem(BaseModel):
    inventory_id: int
    product_id: int
    product_number: str
    product_name: str
    quantity: Decimal
    reserved_quantity: Decimal
    available_quantity: Decimal
    unit: str


class LowStockItem(BaseModel):
    product_id: int
    product_number: str
    product_name: str
    warehouse_id: int
    warehouse_code: str
    on_hand: Decimal
    threshold: Decimal


class StockMovementItem(BaseModel):
    id: int
    movement_type: str
    reference_type: str | None
    reference_number: str | None
    product_id: int
    product_number: str
    product_name: str
    from_bin_code: str | None
    to_bin_code: str | None
    quantity: Decimal
    performed_at: datetime


class InventorySummary(BaseModel):
    total_products_with_stock: int
    total_quantity: Decimal
    reserved_quantity: Decimal
    available_quantity: Decimal
    low_stock_count: int
