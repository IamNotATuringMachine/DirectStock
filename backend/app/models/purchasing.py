from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import JSON, Date, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class PurchaseOrder(TimestampMixin, Base):
    __tablename__ = "purchase_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_number: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    supplier_id: Mapped[int | None] = mapped_column(
        ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    status: Mapped[str] = mapped_column(String(24), default="draft", server_default="draft", index=True)
    expected_delivery_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ordered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    supplier_comm_status: Mapped[str] = mapped_column(
        String(32),
        default="open_unsent",
        server_default="open_unsent",
        index=True,
    )
    supplier_delivery_date: Mapped[date | None] = mapped_column(Date(), nullable=True)
    supplier_email_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    supplier_reply_received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    supplier_last_reply_note: Mapped[str | None] = mapped_column(Text(), nullable=True)
    supplier_outbound_message_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    supplier_last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    notes: Mapped[str | None] = mapped_column(Text())


class PurchaseOrderItem(TimestampMixin, Base):
    __tablename__ = "purchase_order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    purchase_order_id: Mapped[int] = mapped_column(ForeignKey("purchase_orders.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), index=True)
    ordered_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3))
    received_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0, server_default="0")
    unit: Mapped[str] = mapped_column(String(20), default="piece", server_default="piece")
    unit_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    expected_delivery_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PurchaseOrderEmailEvent(TimestampMixin, Base):
    __tablename__ = "purchase_order_email_events"
    __table_args__ = (
        UniqueConstraint("message_id", name="uq_purchase_order_email_events_message_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    purchase_order_id: Mapped[int] = mapped_column(ForeignKey("purchase_orders.id", ondelete="CASCADE"), index=True)
    direction: Mapped[str] = mapped_column(String(16), index=True)  # outbound | inbound
    event_type: Mapped[str] = mapped_column(String(32), index=True)  # sent | failed | received
    message_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    in_reply_to: Mapped[str | None] = mapped_column(String(255), nullable=True)
    subject: Mapped[str | None] = mapped_column(String(512), nullable=True)
    from_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    to_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON(), nullable=True)


class ClientOperationLog(Base):
    __tablename__ = "client_operation_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    operation_id: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    endpoint: Mapped[str] = mapped_column(String(255), index=True)
    method: Mapped[str] = mapped_column(String(8), index=True)
    status_code: Mapped[int] = mapped_column(index=True)
    response_body: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
