from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class SupplierBase(BaseModel):
    supplier_number: str = Field(min_length=1, max_length=64)
    company_name: str = Field(min_length=1, max_length=255)
    contact_name: str | None = Field(default=None, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    is_active: bool = True


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(BaseModel):
    company_name: str | None = Field(default=None, min_length=1, max_length=255)
    contact_name: str | None = Field(default=None, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    is_active: bool | None = None


class SupplierResponse(SupplierBase):
    id: int
    created_at: datetime
    updated_at: datetime


class SupplierListResponse(BaseModel):
    items: list[SupplierResponse]
    total: int
    page: int
    page_size: int


class ProductSupplierCreate(BaseModel):
    supplier_id: int
    supplier_product_number: str | None = Field(default=None, max_length=100)
    price: Decimal | None = None
    lead_time_days: int | None = None
    min_order_quantity: Decimal | None = None
    is_preferred: bool = False


class ProductSupplierUpdate(BaseModel):
    supplier_product_number: str | None = Field(default=None, max_length=100)
    price: Decimal | None = None
    lead_time_days: int | None = None
    min_order_quantity: Decimal | None = None
    is_preferred: bool | None = None


class ProductSupplierResponse(BaseModel):
    id: int
    product_id: int
    supplier_id: int
    supplier_product_number: str | None
    price: Decimal | None
    lead_time_days: int | None
    min_order_quantity: Decimal | None
    is_preferred: bool
    created_at: datetime
    updated_at: datetime
