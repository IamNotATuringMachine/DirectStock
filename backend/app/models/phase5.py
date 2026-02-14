from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class AppPage(TimestampMixin, Base):
    __tablename__ = "app_pages"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)


class UserUiPreference(TimestampMixin, Base):
    __tablename__ = "user_ui_preferences"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    theme: Mapped[str] = mapped_column(String(12), default="system", server_default="system")
    compact_mode: Mapped[bool] = mapped_column(Boolean(), default=False, server_default="false")
    show_help: Mapped[bool] = mapped_column(Boolean(), default=True, server_default="true")


class DashboardCard(TimestampMixin, Base):
    __tablename__ = "dashboard_cards"

    id: Mapped[int] = mapped_column(primary_key=True)
    card_key: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    default_order: Mapped[int] = mapped_column(Integer(), default=0, server_default="0")
    is_active: Mapped[bool] = mapped_column(Boolean(), default=True, server_default="true")


class RoleDashboardPolicy(TimestampMixin, Base):
    __tablename__ = "role_dashboard_policies"
    __table_args__ = (UniqueConstraint("role_id", "card_key", name="uq_role_dashboard_policies_role_card"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id", ondelete="CASCADE"), index=True)
    card_key: Mapped[str] = mapped_column(String(100), index=True)
    allowed: Mapped[bool] = mapped_column(Boolean(), default=True, server_default="true")
    default_visible: Mapped[bool] = mapped_column(Boolean(), default=True, server_default="true")
    locked: Mapped[bool] = mapped_column(Boolean(), default=False, server_default="false")


class UserDashboardConfig(TimestampMixin, Base):
    __tablename__ = "user_dashboard_configs"
    __table_args__ = (UniqueConstraint("user_id", "card_key", name="uq_user_dashboard_configs_user_card"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    card_key: Mapped[str] = mapped_column(String(100), index=True)
    visible: Mapped[bool] = mapped_column(Boolean(), default=True, server_default="true")
    display_order: Mapped[int] = mapped_column(Integer(), default=0, server_default="0")


class ProductBasePrice(TimestampMixin, Base):
    __tablename__ = "product_base_prices"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    net_price: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    currency: Mapped[str] = mapped_column(String(3), default="EUR", server_default="EUR", index=True)
    valid_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    valid_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean(), default=True, server_default="true")


class CustomerProductPrice(TimestampMixin, Base):
    __tablename__ = "customer_product_prices"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    net_price: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    currency: Mapped[str] = mapped_column(String(3), default="EUR", server_default="EUR", index=True)
    valid_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    valid_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean(), default=True, server_default="true")


class Service(TimestampMixin, Base):
    __tablename__ = "services"

    id: Mapped[int] = mapped_column(primary_key=True)
    service_number: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    net_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0, server_default="0")
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=19, server_default="19")
    currency: Mapped[str] = mapped_column(String(3), default="EUR", server_default="EUR")
    status: Mapped[str] = mapped_column(String(20), default="active", server_default="active", index=True)


class SalesOrder(TimestampMixin, Base):
    __tablename__ = "sales_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_number: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(24), default="draft", server_default="draft", index=True)
    ordered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    currency: Mapped[str] = mapped_column(String(3), default="EUR", server_default="EUR")
    notes: Mapped[str | None] = mapped_column(Text(), nullable=True)


class SalesOrderItem(TimestampMixin, Base):
    __tablename__ = "sales_order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    sales_order_id: Mapped[int] = mapped_column(ForeignKey("sales_orders.id", ondelete="CASCADE"), index=True)
    line_no: Mapped[int] = mapped_column(Integer(), default=1, server_default="1")
    item_type: Mapped[str] = mapped_column(String(20), index=True)  # product | service
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), nullable=True, index=True)
    service_id: Mapped[int | None] = mapped_column(ForeignKey("services.id", ondelete="RESTRICT"), nullable=True, index=True)
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0, server_default="0")
    delivered_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0, server_default="0")
    invoiced_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0, server_default="0")
    unit: Mapped[str] = mapped_column(String(20), default="piece", server_default="piece")
    net_unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0, server_default="0")
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=19, server_default="19")


class SalesOrderGoodsIssueLink(TimestampMixin, Base):
    __tablename__ = "sales_order_goods_issue_links"
    __table_args__ = (
        UniqueConstraint("sales_order_id", "goods_issue_id", name="uq_sales_order_goods_issue_links_pair"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    sales_order_id: Mapped[int] = mapped_column(ForeignKey("sales_orders.id", ondelete="CASCADE"), index=True)
    goods_issue_id: Mapped[int] = mapped_column(ForeignKey("goods_issues.id", ondelete="CASCADE"), index=True)


class Invoice(TimestampMixin, Base):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_number: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    sales_order_id: Mapped[int] = mapped_column(ForeignKey("sales_orders.id", ondelete="RESTRICT"), index=True)
    status: Mapped[str] = mapped_column(String(24), default="draft", server_default="draft", index=True)
    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    currency: Mapped[str] = mapped_column(String(3), default="EUR", server_default="EUR")
    total_net: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0, server_default="0")
    total_tax: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0, server_default="0")
    total_gross: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0, server_default="0")
    notes: Mapped[str | None] = mapped_column(Text(), nullable=True)


class InvoiceItem(TimestampMixin, Base):
    __tablename__ = "invoice_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"), index=True)
    sales_order_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("sales_order_items.id", ondelete="SET NULL"), nullable=True, index=True
    )
    line_no: Mapped[int] = mapped_column(Integer(), default=1, server_default="1")
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0, server_default="0")
    unit: Mapped[str] = mapped_column(String(20), default="piece", server_default="piece")
    net_unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0, server_default="0")
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=19, server_default="19")
    net_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0, server_default="0")
    tax_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0, server_default="0")
    gross_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0, server_default="0")


class BillingSetting(TimestampMixin, Base):
    __tablename__ = "billing_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    legal_name: Mapped[str] = mapped_column(String(255))
    vat_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    tax_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    seller_endpoint_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    seller_street: Mapped[str | None] = mapped_column(String(255), nullable=True)
    seller_postal_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    seller_city: Mapped[str | None] = mapped_column(String(128), nullable=True)
    seller_country_code: Mapped[str] = mapped_column(String(2), default="DE", server_default="DE")
    iban: Mapped[str | None] = mapped_column(String(64), nullable=True)
    bic: Mapped[str | None] = mapped_column(String(32), nullable=True)
    payment_terms_days: Mapped[int] = mapped_column(Integer(), default=14, server_default="14")


class InvoiceExport(TimestampMixin, Base):
    __tablename__ = "invoice_exports"

    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"), index=True)
    export_type: Mapped[str] = mapped_column(String(24), index=True)  # xrechnung | zugferd
    status: Mapped[str] = mapped_column(String(24), default="pending", server_default="pending", index=True)
    document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True)
    validator_report_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    exported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text(), nullable=True)
