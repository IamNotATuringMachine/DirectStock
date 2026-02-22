from datetime import date, datetime
from decimal import Decimal
from typing import Any

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
    supplier_comm_status: str
    supplier_delivery_date: date | None
    supplier_email_sent_at: datetime | None
    supplier_reply_received_at: datetime | None
    supplier_last_reply_note: str | None
    supplier_outbound_message_id: str | None
    supplier_last_sync_at: datetime | None
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


class PurchaseOrderSupplierConfirmationUpdate(BaseModel):
    supplier_comm_status: str = Field(pattern="^(confirmed_with_date|confirmed_undetermined)$")
    supplier_delivery_date: date | None = None
    supplier_last_reply_note: str | None = None


class PurchaseOrderEmailSendResponse(BaseModel):
    order: PurchaseOrderResponse
    communication_event_id: int
    document_id: int
    message_id: str


class PurchaseOrderMailSyncResponse(BaseModel):
    processed: int
    matched: int
    skipped: int
    imported_document_ids: list[int]


class PurchaseOrderCommunicationEventResponse(BaseModel):
    id: int
    purchase_order_id: int
    direction: str
    event_type: str
    message_id: str | None
    in_reply_to: str | None
    subject: str | None
    from_address: str | None
    to_address: str | None
    occurred_at: datetime
    document_id: int | None
    created_by: int | None
    metadata_json: dict[str, Any] | None
    created_at: datetime
    updated_at: datetime


class PurchaseOrderCommunicationListResponse(BaseModel):
    items: list[PurchaseOrderCommunicationEventResponse]
