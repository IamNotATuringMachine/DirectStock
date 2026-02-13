from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field


class IntegrationClientCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    client_id: str = Field(min_length=3, max_length=120)
    scopes: list[str] = Field(default_factory=list)
    token_ttl_minutes: int = Field(default=30, ge=5, le=120)
    is_active: bool = True
    notes: str | None = None


class IntegrationClientUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    scopes: list[str] | None = None
    token_ttl_minutes: int | None = Field(default=None, ge=5, le=120)
    is_active: bool | None = None
    notes: str | None = None


class IntegrationClientResponse(BaseModel):
    id: int
    name: str
    client_id: str
    scopes: list[str]
    token_ttl_minutes: int
    is_active: bool
    last_used_at: datetime | None
    secret_rotated_at: datetime | None
    created_by: int | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class IntegrationClientSecretResponse(BaseModel):
    client: IntegrationClientResponse
    client_secret: str


class IntegrationClientRotateSecretResponse(BaseModel):
    client_id: str
    client_secret: str
    rotated_at: datetime


class ExternalTokenRequest(BaseModel):
    client_id: str = Field(min_length=3, max_length=120)
    client_secret: str = Field(min_length=8, max_length=255)
    scope: str | None = None


class ExternalTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    scope: str


class ExternalProductResponse(BaseModel):
    id: int
    product_number: str
    name: str
    unit: str
    status: str
    updated_at: datetime


class ExternalWarehouseResponse(BaseModel):
    id: int
    code: str
    name: str
    is_active: bool
    updated_at: datetime


class ExternalInventoryResponse(BaseModel):
    product_id: int
    product_number: str
    product_name: str
    warehouse_id: int
    warehouse_code: str
    quantity: Decimal
    reserved_quantity: Decimal
    available_quantity: Decimal
    unit: str


class ExternalMovementResponse(BaseModel):
    id: int
    movement_type: str
    reference_type: str | None
    reference_number: str | None
    product_id: int
    quantity: Decimal
    from_bin_id: int | None
    to_bin_id: int | None
    performed_at: datetime


class ExternalCommandPurchaseOrderItem(BaseModel):
    product_id: int
    ordered_quantity: Decimal = Field(gt=Decimal("0"))
    unit: str = Field(default="piece", min_length=1, max_length=20)
    unit_price: Decimal | None = None


class ExternalCommandPurchaseOrderCreate(BaseModel):
    order_number: str | None = Field(default=None, max_length=64)
    supplier_id: int | None = None
    expected_delivery_at: datetime | None = None
    notes: str | None = None
    items: list[ExternalCommandPurchaseOrderItem] = Field(default_factory=list, min_length=1)


class ExternalCommandPurchaseOrderResponse(BaseModel):
    purchase_order_id: int
    order_number: str
    status: str


class ExternalCommandGoodsIssueItem(BaseModel):
    product_id: int
    requested_quantity: Decimal = Field(gt=Decimal("0"))
    unit: str = Field(default="piece", min_length=1, max_length=20)
    source_bin_id: int
    batch_number: str | None = Field(default=None, max_length=64)
    use_fefo: bool = False
    serial_numbers: list[str] | None = None


class ExternalCommandGoodsIssueCreate(BaseModel):
    issue_number: str | None = Field(default=None, max_length=64)
    customer_id: int | None = None
    customer_reference: str | None = Field(default=None, max_length=100)
    notes: str | None = None
    items: list[ExternalCommandGoodsIssueItem] = Field(default_factory=list, min_length=1)


class ExternalCommandGoodsIssueResponse(BaseModel):
    goods_issue_id: int
    issue_number: str
    status: str


class ShipmentCreate(BaseModel):
    shipment_number: str | None = Field(default=None, max_length=64)
    carrier: Literal["dhl", "dpd", "ups"]
    goods_issue_id: int | None = None
    recipient_name: str | None = None
    shipping_address: str | None = None
    notes: str | None = None


class ShipmentResponse(BaseModel):
    id: int
    shipment_number: str
    carrier: str
    status: str
    goods_issue_id: int | None
    tracking_number: str | None
    recipient_name: str | None
    shipping_address: str | None
    label_document_id: int | None
    created_by: int | None
    shipped_at: datetime | None
    cancelled_at: datetime | None
    metadata_json: dict[str, Any] | None
    created_at: datetime
    updated_at: datetime


class ShipmentEventResponse(BaseModel):
    id: int
    shipment_id: int
    event_type: str
    status: str
    description: str | None
    event_at: datetime
    source: str
    payload_json: dict[str, Any] | None
    created_by: int | None
    created_at: datetime
    updated_at: datetime


class ShipmentTrackingResponse(BaseModel):
    shipment: ShipmentResponse
    events: list[ShipmentEventResponse]


class CarrierWebhookPayload(BaseModel):
    tracking_number: str
    event_type: str
    status: str
    description: str | None = None
    event_at: datetime | None = None
    payload: dict[str, Any] | None = None


class InterWarehouseTransferCreate(BaseModel):
    transfer_number: str | None = Field(default=None, max_length=64)
    from_warehouse_id: int
    to_warehouse_id: int
    notes: str | None = None


class InterWarehouseTransferItemCreate(BaseModel):
    product_id: int
    from_bin_id: int
    to_bin_id: int
    requested_quantity: Decimal = Field(gt=Decimal("0"))
    unit: str = Field(default="piece", min_length=1, max_length=20)
    batch_number: str | None = Field(default=None, max_length=64)
    serial_numbers: list[str] | None = None


class InterWarehouseTransferItemResponse(BaseModel):
    id: int
    inter_warehouse_transfer_id: int
    product_id: int
    from_bin_id: int
    to_bin_id: int
    requested_quantity: Decimal
    dispatched_quantity: Decimal
    received_quantity: Decimal
    unit: str
    batch_number: str | None
    serial_numbers: list[str] | None
    created_at: datetime
    updated_at: datetime


class InterWarehouseTransferResponse(BaseModel):
    id: int
    transfer_number: str
    from_warehouse_id: int
    to_warehouse_id: int
    status: str
    requested_at: datetime | None
    dispatched_at: datetime | None
    received_at: datetime | None
    cancelled_at: datetime | None
    created_by: int | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class InterWarehouseTransferDetailResponse(BaseModel):
    transfer: InterWarehouseTransferResponse
    items: list[InterWarehouseTransferItemResponse]


class DemandForecastRecomputeRequest(BaseModel):
    date_from: date | None = None
    date_to: date | None = None
    warehouse_id: int | None = None


class TrendRow(BaseModel):
    day: date
    product_id: int
    product_number: str
    product_name: str
    outbound_quantity: Decimal


class TrendResponse(BaseModel):
    items: list[TrendRow]


class DemandForecastRow(BaseModel):
    run_id: int
    product_id: int
    product_number: str
    product_name: str
    warehouse_id: int | None
    historical_mean: Decimal
    trend_slope: Decimal
    confidence_score: Decimal
    history_days_used: int
    forecast_qty_7: Decimal
    forecast_qty_30: Decimal
    forecast_qty_90: Decimal


class DemandForecastResponse(BaseModel):
    items: list[DemandForecastRow]
    total: int
