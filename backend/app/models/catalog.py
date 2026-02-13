from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class ProductGroup(TimestampMixin, Base):
    __tablename__ = "product_groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text())
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("product_groups.id", ondelete="SET NULL"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")


class Product(TimestampMixin, Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("status in ('active','blocked','deprecated','archived')", name="product_status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_number: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    description: Mapped[str | None] = mapped_column(Text())
    product_group_id: Mapped[int | None] = mapped_column(
        ForeignKey("product_groups.id", ondelete="SET NULL"), nullable=True
    )
    unit: Mapped[str] = mapped_column(String(20), default="piece", server_default="piece")
    status: Mapped[str] = mapped_column(String(20), default="active", server_default="active")

    group: Mapped[ProductGroup | None] = relationship("ProductGroup", lazy="selectin")


class Supplier(TimestampMixin, Base):
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(primary_key=True)
    supplier_number: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    company_name: Mapped[str] = mapped_column(String(255), index=True)
    contact_name: Mapped[str | None] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")


class Customer(TimestampMixin, Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_number: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    company_name: Mapped[str] = mapped_column(String(255), index=True)
    contact_name: Mapped[str | None] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50))
    billing_address: Mapped[str | None] = mapped_column(Text())
    shipping_address: Mapped[str | None] = mapped_column(Text())
    payment_terms: Mapped[str | None] = mapped_column(String(255))
    delivery_terms: Mapped[str | None] = mapped_column(String(255))
    credit_limit: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")


class ProductSupplier(TimestampMixin, Base):
    __tablename__ = "product_suppliers"
    __table_args__ = (UniqueConstraint("product_id", "supplier_id", name="uq_product_supplier"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id", ondelete="CASCADE"), index=True)
    supplier_product_number: Mapped[str | None] = mapped_column(String(100))
    price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    lead_time_days: Mapped[int | None] = mapped_column()
    min_order_quantity: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    is_preferred: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")


class ProductWarehouseSetting(TimestampMixin, Base):
    __tablename__ = "product_warehouse_settings"
    __table_args__ = (UniqueConstraint("product_id", "warehouse_id", name="uq_product_warehouse"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id", ondelete="CASCADE"), index=True)
    ean: Mapped[str | None] = mapped_column(String(32), index=True)
    gtin: Mapped[str | None] = mapped_column(String(32), index=True)
    net_weight: Mapped[Decimal | None] = mapped_column(Numeric(12, 3))
    gross_weight: Mapped[Decimal | None] = mapped_column(Numeric(12, 3))
    length_cm: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    width_cm: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    height_cm: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    min_stock: Mapped[Decimal | None] = mapped_column(Numeric(14, 3))
    reorder_point: Mapped[Decimal | None] = mapped_column(Numeric(14, 3))
    max_stock: Mapped[Decimal | None] = mapped_column(Numeric(14, 3))
    safety_stock: Mapped[Decimal | None] = mapped_column(Numeric(14, 3))
    lead_time_days: Mapped[int | None] = mapped_column()
    qr_code_data: Mapped[str | None] = mapped_column(String(255), unique=True)
