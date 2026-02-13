from datetime import datetime

from pydantic import BaseModel, Field


class ProductGroupBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    parent_id: int | None = None
    is_active: bool = True


class ProductGroupCreate(ProductGroupBase):
    pass


class ProductGroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    parent_id: int | None = None
    is_active: bool | None = None


class ProductGroupResponse(ProductGroupBase):
    id: int
    created_at: datetime
    updated_at: datetime


class ProductBase(BaseModel):
    product_number: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    product_group_id: int | None = None
    unit: str = Field(default="piece", min_length=1, max_length=20)
    status: str = Field(default="active", pattern="^(active|blocked|deprecated|archived)$")


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    product_group_id: int | None = None
    unit: str | None = Field(default=None, min_length=1, max_length=20)
    status: str | None = Field(default=None, pattern="^(active|blocked|deprecated|archived)$")


class ProductResponse(ProductBase):
    id: int
    group_name: str | None = None
    created_at: datetime
    updated_at: datetime


class ProductListResponse(BaseModel):
    items: list[ProductResponse]
    total: int
    page: int
    page_size: int
