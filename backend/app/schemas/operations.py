from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class GoodsReceiptCreate(BaseModel):
    receipt_number: str | None = Field(default=None, max_length=64)
    supplier_id: int | None = None
    purchase_order_id: int | None = None
    notes: str | None = None


class GoodsReceiptUpdate(BaseModel):
    supplier_id: int | None = None
    purchase_order_id: int | None = None
    notes: str | None = None


class GoodsReceiptResponse(BaseModel):
    id: int
    receipt_number: str
    supplier_id: int | None
    purchase_order_id: int | None
    status: str
    received_at: datetime | None
    completed_at: datetime | None
    created_by: int | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class GoodsReceiptItemCreate(BaseModel):
    product_id: int
    expected_quantity: Decimal | None = None
    received_quantity: Decimal = Field(default=Decimal("0"), gt=Decimal("0"))
    unit: str = Field(default="piece", min_length=1, max_length=20)
    target_bin_id: int
    batch_number: str | None = Field(default=None, max_length=64)
    expiry_date: date | None = None
    manufactured_at: date | None = None
    serial_numbers: list[str] | None = None
    purchase_order_item_id: int | None = None
    condition: str = Field(default="new", pattern="^(new|defective|needs_repair)$")


class GoodsReceiptItemUpdate(BaseModel):
    expected_quantity: Decimal | None = None
    received_quantity: Decimal | None = Field(default=None, gt=Decimal("0"))
    unit: str | None = Field(default=None, min_length=1, max_length=20)
    target_bin_id: int | None = None
    batch_number: str | None = Field(default=None, max_length=64)
    expiry_date: date | None = None
    manufactured_at: date | None = None
    serial_numbers: list[str] | None = None
    purchase_order_item_id: int | None = None
    condition: str | None = Field(default=None, pattern="^(new|defective|needs_repair)$")


class GoodsReceiptItemResponse(BaseModel):
    id: int
    goods_receipt_id: int
    product_id: int
    expected_quantity: Decimal | None
    received_quantity: Decimal
    unit: str
    target_bin_id: int | None
    batch_number: str | None
    expiry_date: date | None
    manufactured_at: date | None
    serial_numbers: list[str] | None
    purchase_order_item_id: int | None
    condition: str
    created_at: datetime
    updated_at: datetime


class GoodsIssueCreate(BaseModel):
    issue_number: str | None = Field(default=None, max_length=64)
    customer_id: int | None = None
    customer_location_id: int | None = None
    customer_reference: str | None = Field(default=None, max_length=100)
    notes: str | None = None


class GoodsIssueUpdate(BaseModel):
    customer_id: int | None = None
    customer_location_id: int | None = None
    customer_reference: str | None = Field(default=None, max_length=100)
    notes: str | None = None


class GoodsIssueResponse(BaseModel):
    id: int
    issue_number: str
    customer_id: int | None
    customer_location_id: int | None
    customer_reference: str | None
    status: str
    issued_at: datetime | None
    completed_at: datetime | None
    created_by: int | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class GoodsIssueItemCreate(BaseModel):
    product_id: int
    requested_quantity: Decimal = Field(gt=Decimal("0"))
    issued_quantity: Decimal | None = Field(default=None, gt=Decimal("0"))
    unit: str = Field(default="piece", min_length=1, max_length=20)
    source_bin_id: int
    batch_number: str | None = Field(default=None, max_length=64)
    use_fefo: bool = False
    serial_numbers: list[str] | None = None


class GoodsIssueItemUpdate(BaseModel):
    requested_quantity: Decimal | None = Field(default=None, gt=Decimal("0"))
    issued_quantity: Decimal | None = Field(default=None, gt=Decimal("0"))
    unit: str | None = Field(default=None, min_length=1, max_length=20)
    source_bin_id: int | None = None
    batch_number: str | None = Field(default=None, max_length=64)
    use_fefo: bool | None = None
    serial_numbers: list[str] | None = None


class GoodsIssueItemResponse(BaseModel):
    id: int
    goods_issue_id: int
    product_id: int
    requested_quantity: Decimal
    issued_quantity: Decimal
    unit: str
    source_bin_id: int | None
    batch_number: str | None
    use_fefo: bool
    serial_numbers: list[str] | None
    created_at: datetime
    updated_at: datetime


class StockTransferCreate(BaseModel):
    transfer_number: str | None = Field(default=None, max_length=64)
    notes: str | None = None


class StockTransferUpdate(BaseModel):
    notes: str | None = None


class StockTransferResponse(BaseModel):
    id: int
    transfer_number: str
    status: str
    transferred_at: datetime | None
    completed_at: datetime | None
    created_by: int | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class StockTransferItemCreate(BaseModel):
    product_id: int
    quantity: Decimal = Field(gt=Decimal("0"))
    unit: str = Field(default="piece", min_length=1, max_length=20)
    from_bin_id: int
    to_bin_id: int
    batch_number: str | None = Field(default=None, max_length=64)
    serial_numbers: list[str] | None = None


class StockTransferItemUpdate(BaseModel):
    quantity: Decimal | None = Field(default=None, gt=Decimal("0"))
    unit: str | None = Field(default=None, min_length=1, max_length=20)
    from_bin_id: int | None = None
    to_bin_id: int | None = None
    batch_number: str | None = Field(default=None, max_length=64)
    serial_numbers: list[str] | None = None


class StockTransferItemResponse(BaseModel):
    id: int
    stock_transfer_id: int
    product_id: int
    quantity: Decimal
    unit: str
    from_bin_id: int
    to_bin_id: int
    batch_number: str | None
    serial_numbers: list[str] | None
    created_at: datetime
    updated_at: datetime


class BinSuggestion(BaseModel):
    bin_id: int
    bin_code: str
    zone_id: int
    zone_code: str
    warehouse_id: int
    warehouse_code: str
    priority: str  # "default" | "existing"
    current_quantity: Decimal
