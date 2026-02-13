from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class GoodsReceiptCreate(BaseModel):
    receipt_number: str | None = Field(default=None, max_length=64)
    supplier_id: int | None = None
    notes: str | None = None


class GoodsReceiptUpdate(BaseModel):
    supplier_id: int | None = None
    notes: str | None = None


class GoodsReceiptResponse(BaseModel):
    id: int
    receipt_number: str
    supplier_id: int | None
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


class GoodsReceiptItemUpdate(BaseModel):
    expected_quantity: Decimal | None = None
    received_quantity: Decimal | None = Field(default=None, gt=Decimal("0"))
    unit: str | None = Field(default=None, min_length=1, max_length=20)
    target_bin_id: int | None = None


class GoodsReceiptItemResponse(BaseModel):
    id: int
    goods_receipt_id: int
    product_id: int
    expected_quantity: Decimal | None
    received_quantity: Decimal
    unit: str
    target_bin_id: int | None
    created_at: datetime
    updated_at: datetime


class GoodsIssueCreate(BaseModel):
    issue_number: str | None = Field(default=None, max_length=64)
    customer_reference: str | None = Field(default=None, max_length=100)
    notes: str | None = None


class GoodsIssueUpdate(BaseModel):
    customer_reference: str | None = Field(default=None, max_length=100)
    notes: str | None = None


class GoodsIssueResponse(BaseModel):
    id: int
    issue_number: str
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


class GoodsIssueItemUpdate(BaseModel):
    requested_quantity: Decimal | None = Field(default=None, gt=Decimal("0"))
    issued_quantity: Decimal | None = Field(default=None, gt=Decimal("0"))
    unit: str | None = Field(default=None, min_length=1, max_length=20)
    source_bin_id: int | None = None


class GoodsIssueItemResponse(BaseModel):
    id: int
    goods_issue_id: int
    product_id: int
    requested_quantity: Decimal
    issued_quantity: Decimal
    unit: str
    source_bin_id: int | None
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


class StockTransferItemUpdate(BaseModel):
    quantity: Decimal | None = Field(default=None, gt=Decimal("0"))
    unit: str | None = Field(default=None, min_length=1, max_length=20)
    from_bin_id: int | None = None
    to_bin_id: int | None = None


class StockTransferItemResponse(BaseModel):
    id: int
    stock_transfer_id: int
    product_id: int
    quantity: Decimal
    unit: str
    from_bin_id: int
    to_bin_id: int
    created_at: datetime
    updated_at: datetime
