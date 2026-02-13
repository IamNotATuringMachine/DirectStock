from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field


class AbcRecomputeRequest(BaseModel):
    date_from: date | None = None
    date_to: date | None = None


class AbcClassificationRunResponse(BaseModel):
    id: int
    date_from: date
    date_to: date
    total_outbound_quantity: Decimal
    generated_by: int | None
    generated_at: datetime
    created_at: datetime
    updated_at: datetime


class AbcClassificationItemResponse(BaseModel):
    id: int
    run_id: int
    rank: int
    product_id: int
    product_number: str
    product_name: str
    outbound_quantity: Decimal
    share_percent: Decimal
    cumulative_share_percent: Decimal
    category: str
    created_at: datetime
    updated_at: datetime


class AbcClassificationListResponse(BaseModel):
    run: AbcClassificationRunResponse
    items: list[AbcClassificationItemResponse]


class PurchaseRecommendationGenerateRequest(BaseModel):
    warehouse_id: int | None = None


class PurchaseRecommendationResponse(BaseModel):
    id: int
    product_id: int
    warehouse_id: int | None
    supplier_id: int | None
    status: str
    target_stock: Decimal
    on_hand_quantity: Decimal
    open_po_quantity: Decimal
    deficit_quantity: Decimal
    recommended_quantity: Decimal
    min_order_quantity: Decimal
    converted_purchase_order_id: int | None
    generated_by: int | None
    generated_at: datetime
    metadata_json: dict[str, Any] | None
    created_at: datetime
    updated_at: datetime


class PurchaseRecommendationListResponse(BaseModel):
    items: list[PurchaseRecommendationResponse]
    total: int


class PurchaseRecommendationConvertResponse(BaseModel):
    recommendation_id: int
    purchase_order_id: int
    purchase_order_number: str


class PickWaveCreate(BaseModel):
    wave_number: str | None = Field(default=None, max_length=64)
    goods_issue_ids: list[int] | None = None
    notes: str | None = None


class PickWaveResponse(BaseModel):
    id: int
    wave_number: str
    status: str
    notes: str | None
    released_at: datetime | None
    completed_at: datetime | None
    created_by: int | None
    created_at: datetime
    updated_at: datetime


class PickTaskResponse(BaseModel):
    id: int
    pick_wave_id: int
    goods_issue_id: int | None
    goods_issue_item_id: int | None
    product_id: int
    product_number: str
    product_name: str
    source_bin_id: int | None
    source_bin_code: str | None
    quantity: Decimal
    picked_quantity: Decimal
    unit: str
    status: str
    sequence_no: int
    picked_at: datetime | None
    picked_by: int | None
    created_at: datetime
    updated_at: datetime


class PickWaveDetailResponse(BaseModel):
    wave: PickWaveResponse
    tasks: list[PickTaskResponse]


class PickTaskUpdate(BaseModel):
    status: Literal["open", "picked", "skipped"]
    picked_quantity: Decimal | None = Field(default=None, ge=Decimal("0"))


class ReturnOrderCreate(BaseModel):
    return_number: str | None = Field(default=None, max_length=64)
    customer_id: int | None = None
    goods_issue_id: int | None = None
    notes: str | None = None


class ReturnOrderUpdate(BaseModel):
    customer_id: int | None = None
    goods_issue_id: int | None = None
    notes: str | None = None


class ReturnOrderStatusUpdate(BaseModel):
    status: Literal["registered", "received", "inspected", "resolved", "cancelled"]


class ReturnOrderResponse(BaseModel):
    id: int
    return_number: str
    customer_id: int | None
    goods_issue_id: int | None
    status: str
    notes: str | None
    registered_at: datetime | None
    received_at: datetime | None
    inspected_at: datetime | None
    resolved_at: datetime | None
    created_by: int | None
    created_at: datetime
    updated_at: datetime


class ReturnOrderItemCreate(BaseModel):
    product_id: int
    quantity: Decimal = Field(gt=Decimal("0"))
    unit: str = Field(default="piece", min_length=1, max_length=20)
    decision: Literal["restock", "repair", "scrap", "return_supplier"] | None = None
    target_bin_id: int | None = None
    reason: str | None = None


class ReturnOrderItemUpdate(BaseModel):
    quantity: Decimal | None = Field(default=None, gt=Decimal("0"))
    unit: str | None = Field(default=None, min_length=1, max_length=20)
    decision: Literal["restock", "repair", "scrap", "return_supplier"] | None = None
    target_bin_id: int | None = None
    reason: str | None = None


class ReturnOrderItemResponse(BaseModel):
    id: int
    return_order_id: int
    product_id: int
    quantity: Decimal
    unit: str
    decision: str | None
    target_bin_id: int | None
    reason: str | None
    created_at: datetime
    updated_at: datetime


class ApprovalRuleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    entity_type: Literal["purchase_order", "return_order"]
    min_amount: Decimal | None = None
    required_role: str = Field(default="lagerleiter", min_length=1, max_length=64)
    is_active: bool = True


class ApprovalRuleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    min_amount: Decimal | None = None
    required_role: str | None = Field(default=None, min_length=1, max_length=64)
    is_active: bool | None = None


class ApprovalRuleResponse(BaseModel):
    id: int
    name: str
    entity_type: str
    min_amount: Decimal | None
    required_role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ApprovalRequestCreate(BaseModel):
    entity_type: Literal["purchase_order", "return_order"]
    entity_id: int
    amount: Decimal | None = None
    reason: str | None = None


class ApprovalRequestAction(BaseModel):
    comment: str | None = None


class ApprovalRequestResponse(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    status: str
    amount: Decimal | None
    reason: str | None
    requested_by: int | None
    requested_at: datetime
    decided_by: int | None
    decided_at: datetime | None
    created_at: datetime
    updated_at: datetime


class DocumentResponse(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    document_type: str
    file_name: str
    mime_type: str
    file_size: int
    storage_path: str
    version: int
    uploaded_by: int | None
    created_at: datetime
    updated_at: datetime


class DocumentListResponse(BaseModel):
    items: list[DocumentResponse]
    total: int


class AuditLogEntryResponse(BaseModel):
    id: int
    request_id: str
    user_id: int | None
    action: str
    endpoint: str | None
    method: str | None
    entity: str
    entity_id: str | None
    changed_fields: list[str] | None
    old_values: dict[str, Any] | None
    new_values: dict[str, Any] | None
    entity_snapshot_before: dict[str, Any] | None
    entity_snapshot_after: dict[str, Any] | None
    status_code: int
    ip_address: str | None
    error_message: str | None
    created_at: datetime


class AuditLogListResponse(BaseModel):
    items: list[AuditLogEntryResponse]
    total: int
    page: int
    page_size: int
