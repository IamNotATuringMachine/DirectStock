from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class PermissionResponse(BaseModel):
    code: str
    description: str | None


class PageResponse(BaseModel):
    id: int
    slug: str
    title: str
    description: str | None


class RoleResponse(BaseModel):
    id: int
    name: str
    description: str | None
    permissions: list[str]


class RoleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    description: str | None = None
    permission_codes: list[str] = Field(default_factory=list)


class RoleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=64)
    description: str | None = None


class RolePermissionUpdate(BaseModel):
    permission_codes: list[str] = Field(default_factory=list)


class ThemePreferenceResponse(BaseModel):
    theme: Literal["system", "light", "dark"]
    compact_mode: bool
    show_help: bool


class ThemePreferenceUpdate(BaseModel):
    theme: Literal["system", "light", "dark"]
    compact_mode: bool = False
    show_help: bool = True


class DashboardCardCatalogItem(BaseModel):
    card_key: str
    title: str
    description: str | None
    default_order: int
    is_active: bool


class DashboardRolePolicyItem(BaseModel):
    card_key: str
    allowed: bool
    default_visible: bool
    locked: bool


class DashboardRolePolicyUpdateItem(BaseModel):
    card_key: str
    allowed: bool = True
    default_visible: bool = True
    locked: bool = False


class DashboardUserConfigItem(BaseModel):
    card_key: str
    visible: bool
    display_order: int


class DashboardUserConfigUpdateItem(BaseModel):
    card_key: str
    visible: bool = True
    display_order: int = 0


class DashboardUserConfigResponse(BaseModel):
    cards: list[DashboardUserConfigItem]


class DashboardUserConfigUpdate(BaseModel):
    cards: list[DashboardUserConfigUpdateItem] = Field(default_factory=list)


class DashboardRolePolicyResponse(BaseModel):
    role_id: int
    cards: list[DashboardRolePolicyItem]


class DashboardRolePolicyUpdate(BaseModel):
    cards: list[DashboardRolePolicyUpdateItem] = Field(default_factory=list)


class ProductBasePriceCreate(BaseModel):
    net_price: Decimal = Field(gt=Decimal("0"))
    vat_rate: Decimal
    currency: str = Field(default="EUR", min_length=3, max_length=3)
    valid_from: datetime | None = None
    valid_to: datetime | None = None
    is_active: bool = True


class ProductBasePriceResponse(BaseModel):
    id: int
    product_id: int
    net_price: Decimal
    vat_rate: Decimal
    gross_price: Decimal
    currency: str
    valid_from: datetime | None
    valid_to: datetime | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ProductBasePriceListResponse(BaseModel):
    items: list[ProductBasePriceResponse]


class CustomerProductPriceUpsert(BaseModel):
    net_price: Decimal = Field(gt=Decimal("0"))
    vat_rate: Decimal
    currency: str = Field(default="EUR", min_length=3, max_length=3)
    valid_from: datetime
    valid_to: datetime | None = None
    is_active: bool = True


class CustomerProductPriceResponse(BaseModel):
    id: int
    customer_id: int
    product_id: int
    net_price: Decimal
    vat_rate: Decimal
    gross_price: Decimal
    currency: str
    valid_from: datetime
    valid_to: datetime | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CustomerProductPriceListResponse(BaseModel):
    items: list[CustomerProductPriceResponse]


class ResolvedPriceResponse(BaseModel):
    source: Literal["customer", "base", "none"]
    net_price: Decimal | None
    vat_rate: Decimal | None
    gross_price: Decimal | None
    currency: str | None


class SalesOrderItemCreate(BaseModel):
    item_type: Literal["product"] = "product"
    product_id: int
    description: str | None = None
    quantity: Decimal = Field(gt=Decimal("0"))
    unit: str = Field(default="piece", min_length=1, max_length=20)
    net_unit_price: Decimal | None = None
    vat_rate: Decimal | None = None


class SalesOrderCreate(BaseModel):
    order_number: str | None = Field(default=None, max_length=64)
    customer_id: int | None = None
    customer_location_id: int | None = None
    currency: str = Field(default="EUR", min_length=3, max_length=3)
    notes: str | None = None
    items: list[SalesOrderItemCreate] = Field(default_factory=list)


class SalesOrderUpdate(BaseModel):
    customer_id: int | None = None
    customer_location_id: int | None = None
    status: Literal["draft", "confirmed", "partially_delivered", "completed", "cancelled"] | None = None
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    notes: str | None = None


class SalesOrderItemResponse(BaseModel):
    id: int
    sales_order_id: int
    line_no: int
    item_type: Literal["product"]
    product_id: int | None
    description: str | None
    quantity: Decimal
    delivered_quantity: Decimal
    invoiced_quantity: Decimal
    unit: str
    net_unit_price: Decimal
    vat_rate: Decimal
    gross_unit_price: Decimal
    created_at: datetime
    updated_at: datetime


class SalesOrderResponse(BaseModel):
    id: int
    order_number: str
    customer_id: int | None
    customer_location_id: int | None
    status: str
    ordered_at: datetime | None
    completed_at: datetime | None
    created_by: int | None
    currency: str
    notes: str | None
    created_at: datetime
    updated_at: datetime


class SalesOrderDetailResponse(BaseModel):
    order: SalesOrderResponse
    items: list[SalesOrderItemResponse]


class SalesOrderListResponse(BaseModel):
    items: list[SalesOrderResponse]
    total: int
    page: int
    page_size: int


class SalesOrderDeliveryNoteLinkPayload(BaseModel):
    goods_issue_id: int


class InvoiceCreate(BaseModel):
    invoice_number: str | None = Field(default=None, max_length=64)
    sales_order_id: int
    due_at: datetime | None = None
    notes: str | None = None


class InvoicePartialCreate(BaseModel):
    items: list[dict] = Field(default_factory=list)


class InvoiceItemResponse(BaseModel):
    id: int
    invoice_id: int
    sales_order_item_id: int | None
    line_no: int
    description: str | None
    quantity: Decimal
    unit: str
    net_unit_price: Decimal
    vat_rate: Decimal
    net_total: Decimal
    tax_total: Decimal
    gross_total: Decimal
    created_at: datetime
    updated_at: datetime


class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    sales_order_id: int
    status: str
    issued_at: datetime | None
    due_at: datetime | None
    created_by: int | None
    currency: str
    total_net: Decimal
    total_tax: Decimal
    total_gross: Decimal
    notes: str | None
    created_at: datetime
    updated_at: datetime


class InvoiceDetailResponse(BaseModel):
    invoice: InvoiceResponse
    items: list[InvoiceItemResponse]


class InvoiceListResponse(BaseModel):
    items: list[InvoiceResponse]
    total: int
    page: int
    page_size: int


class InvoiceExportResponse(BaseModel):
    export_id: int
    invoice_id: int
    export_type: str
    status: str
    document_id: int | None
    error_message: str | None
    validator_report: dict | None
