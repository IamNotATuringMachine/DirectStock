from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class CustomerBase(BaseModel):
    customer_number: str = Field(min_length=1, max_length=64)
    company_name: str = Field(min_length=1, max_length=255)
    contact_name: str | None = Field(default=None, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    billing_address: str | None = None
    shipping_address: str | None = None
    payment_terms: str | None = Field(default=None, max_length=255)
    delivery_terms: str | None = Field(default=None, max_length=255)
    credit_limit: Decimal | None = None
    is_active: bool = True


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    company_name: str | None = Field(default=None, min_length=1, max_length=255)
    contact_name: str | None = Field(default=None, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    billing_address: str | None = None
    shipping_address: str | None = None
    payment_terms: str | None = Field(default=None, max_length=255)
    delivery_terms: str | None = Field(default=None, max_length=255)
    credit_limit: Decimal | None = None
    is_active: bool | None = None


class CustomerResponse(CustomerBase):
    id: int
    created_at: datetime
    updated_at: datetime


class CustomerListResponse(BaseModel):
    items: list[CustomerResponse]
    total: int
    page: int
    page_size: int
