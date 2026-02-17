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
    requires_item_tracking: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

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


class CustomerLocation(TimestampMixin, Base):
    __tablename__ = "customer_locations"
    __table_args__ = (
        UniqueConstraint("customer_id", "location_code", name="uq_customer_locations_customer_location_code"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), index=True)
    location_code: Mapped[str] = mapped_column(String(64))
    name: Mapped[str] = mapped_column(String(255), index=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    street: Mapped[str | None] = mapped_column(String(255), nullable=True)
    house_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    address_line2: Mapped[str | None] = mapped_column(String(255), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    city: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    country_code: Mapped[str] = mapped_column(String(2), default="DE", server_default="DE")
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")


class CustomerContact(TimestampMixin, Base):
    __tablename__ = "customer_contacts"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), index=True)
    customer_location_id: Mapped[int | None] = mapped_column(
        ForeignKey("customer_locations.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    job_title: Mapped[str | None] = mapped_column(String(128), nullable=True)
    salutation: Mapped[str | None] = mapped_column(String(64), nullable=True)
    first_name: Mapped[str] = mapped_column(String(128))
    last_name: Mapped[str] = mapped_column(String(128), index=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    notes: Mapped[str | None] = mapped_column(Text(), nullable=True)


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
