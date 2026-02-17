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


class CustomerLocationBase(BaseModel):
    location_code: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)
    street: str | None = Field(default=None, max_length=255)
    house_number: str | None = Field(default=None, max_length=32)
    address_line2: str | None = Field(default=None, max_length=255)
    postal_code: str | None = Field(default=None, max_length=32)
    city: str | None = Field(default=None, max_length=128)
    country_code: str = Field(default="DE", min_length=2, max_length=2)
    is_primary: bool = False
    is_active: bool = True


class CustomerLocationCreate(CustomerLocationBase):
    pass


class CustomerLocationUpdate(BaseModel):
    location_code: str | None = Field(default=None, min_length=1, max_length=64)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)
    street: str | None = Field(default=None, max_length=255)
    house_number: str | None = Field(default=None, max_length=32)
    address_line2: str | None = Field(default=None, max_length=255)
    postal_code: str | None = Field(default=None, max_length=32)
    city: str | None = Field(default=None, max_length=128)
    country_code: str | None = Field(default=None, min_length=2, max_length=2)
    is_primary: bool | None = None
    is_active: bool | None = None


class CustomerLocationResponse(CustomerLocationBase):
    id: int
    customer_id: int
    created_at: datetime
    updated_at: datetime


class CustomerLocationListResponse(BaseModel):
    items: list[CustomerLocationResponse]


class CustomerContactBase(BaseModel):
    customer_location_id: int | None = None
    job_title: str | None = Field(default=None, max_length=128)
    salutation: str | None = Field(default=None, max_length=64)
    first_name: str = Field(min_length=1, max_length=128)
    last_name: str = Field(min_length=1, max_length=128)
    phone: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)
    is_primary: bool = False
    is_active: bool = True
    notes: str | None = None


class CustomerContactCreate(CustomerContactBase):
    pass


class CustomerContactUpdate(BaseModel):
    customer_location_id: int | None = None
    job_title: str | None = Field(default=None, max_length=128)
    salutation: str | None = Field(default=None, max_length=64)
    first_name: str | None = Field(default=None, min_length=1, max_length=128)
    last_name: str | None = Field(default=None, min_length=1, max_length=128)
    phone: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)
    is_primary: bool | None = None
    is_active: bool | None = None
    notes: str | None = None


class CustomerContactResponse(CustomerContactBase):
    id: int
    customer_id: int
    created_at: datetime
    updated_at: datetime


class CustomerContactListResponse(BaseModel):
    items: list[CustomerContactResponse]
