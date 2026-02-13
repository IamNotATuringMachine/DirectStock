from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class ReportStockRow(BaseModel):
    product_id: int
    product_number: str
    product_name: str
    total_quantity: Decimal
    reserved_quantity: Decimal
    available_quantity: Decimal
    unit: str


class ReportStockResponse(BaseModel):
    items: list[ReportStockRow]
    total: int
    page: int
    page_size: int


class ReportMovementRow(BaseModel):
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


class ReportMovementResponse(BaseModel):
    items: list[ReportMovementRow]
    total: int
    page: int
    page_size: int


class ReportInboundOutboundRow(BaseModel):
    day: date
    inbound_quantity: Decimal
    outbound_quantity: Decimal
    transfer_quantity: Decimal
    adjustment_quantity: Decimal
    movement_count: int


class ReportInboundOutboundResponse(BaseModel):
    items: list[ReportInboundOutboundRow]


class ReportInventoryAccuracySessionRow(BaseModel):
    session_id: int
    session_number: str
    completed_at: datetime | None
    total_items: int
    counted_items: int
    exact_match_items: int
    recount_required_items: int
    accuracy_percent: Decimal


class ReportInventoryAccuracyResponse(BaseModel):
    total_sessions: int
    total_items: int
    counted_items: int
    exact_match_items: int
    recount_required_items: int
    overall_accuracy_percent: Decimal
    sessions: list[ReportInventoryAccuracySessionRow]


class ReportAbcRow(BaseModel):
    rank: int
    product_id: int
    product_number: str
    product_name: str
    outbound_quantity: Decimal
    share_percent: Decimal
    cumulative_share_percent: Decimal
    category: str


class ReportAbcResponse(BaseModel):
    items: list[ReportAbcRow]


class ReportKpiResponse(BaseModel):
    date_from: date
    date_to: date
    turnover_rate: Decimal
    dock_to_stock_hours: Decimal
    inventory_accuracy_percent: Decimal
    alert_count: int
