from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class AbcClassificationRun(TimestampMixin, Base):
    __tablename__ = "abc_classification_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    date_from: Mapped[date] = mapped_column(Date(), index=True)
    date_to: Mapped[date] = mapped_column(Date(), index=True)
    total_outbound_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0, server_default="0")
    generated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class AbcClassificationItem(TimestampMixin, Base):
    __tablename__ = "abc_classification_items"
    __table_args__ = (
        UniqueConstraint("run_id", "product_id", name="uq_abc_classification_items_run_product"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("abc_classification_runs.id", ondelete="CASCADE"), index=True)
    rank: Mapped[int] = mapped_column(Integer(), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    outbound_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0, server_default="0")
    share_percent: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=0, server_default="0")
    cumulative_share_percent: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=0, server_default="0")
    category: Mapped[str] = mapped_column(String(1), index=True)  # A | B | C


class PurchaseRecommendation(TimestampMixin, Base):
    __tablename__ = "purchase_recommendations"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    warehouse_id: Mapped[int | None] = mapped_column(
        ForeignKey("warehouses.id", ondelete="SET NULL"), nullable=True, index=True
    )
    supplier_id: Mapped[int | None] = mapped_column(
        ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    status: Mapped[str] = mapped_column(String(24), default="open", server_default="open", index=True)
    target_stock: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0, server_default="0")
    on_hand_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0, server_default="0")
    open_po_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0, server_default="0")
    deficit_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0, server_default="0")
    recommended_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0, server_default="0")
    min_order_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=1, server_default="1")
    converted_purchase_order_id: Mapped[int | None] = mapped_column(
        ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True, index=True
    )
    generated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class PickWave(TimestampMixin, Base):
    __tablename__ = "pick_waves"

    id: Mapped[int] = mapped_column(primary_key=True)
    wave_number: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default="draft", server_default="draft", index=True)
    notes: Mapped[str | None] = mapped_column(Text(), nullable=True)
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)


class PickTask(TimestampMixin, Base):
    __tablename__ = "pick_tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    pick_wave_id: Mapped[int] = mapped_column(ForeignKey("pick_waves.id", ondelete="CASCADE"), index=True)
    goods_issue_id: Mapped[int | None] = mapped_column(
        ForeignKey("goods_issues.id", ondelete="SET NULL"), nullable=True, index=True
    )
    goods_issue_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("goods_issue_items.id", ondelete="SET NULL"), nullable=True, index=True
    )
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), index=True)
    source_bin_id: Mapped[int | None] = mapped_column(
        ForeignKey("bin_locations.id", ondelete="SET NULL"), nullable=True, index=True
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0, server_default="0")
    picked_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0, server_default="0")
    unit: Mapped[str] = mapped_column(String(20), default="piece", server_default="piece")
    status: Mapped[str] = mapped_column(String(20), default="open", server_default="open", index=True)
    sequence_no: Mapped[int] = mapped_column(Integer(), default=0, server_default="0", index=True)
    picked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    picked_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)


class ReturnOrder(TimestampMixin, Base):
    __tablename__ = "return_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    return_number: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    customer_id: Mapped[int | None] = mapped_column(
        ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    goods_issue_id: Mapped[int | None] = mapped_column(
        ForeignKey("goods_issues.id", ondelete="SET NULL"), nullable=True, index=True
    )
    status: Mapped[str] = mapped_column(String(24), default="registered", server_default="registered", index=True)
    notes: Mapped[str | None] = mapped_column(Text(), nullable=True)
    registered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    inspected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)


class ReturnOrderItem(TimestampMixin, Base):
    __tablename__ = "return_order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    return_order_id: Mapped[int] = mapped_column(ForeignKey("return_orders.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), index=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0, server_default="0")
    unit: Mapped[str] = mapped_column(String(20), default="piece", server_default="piece")
    decision: Mapped[str | None] = mapped_column(String(24), nullable=True, index=True)
    target_bin_id: Mapped[int | None] = mapped_column(
        ForeignKey("bin_locations.id", ondelete="SET NULL"), nullable=True, index=True
    )
    reason: Mapped[str | None] = mapped_column(Text(), nullable=True)


class ApprovalRule(TimestampMixin, Base):
    __tablename__ = "approval_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    entity_type: Mapped[str] = mapped_column(String(32), index=True)  # purchase_order | return_order
    min_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    required_role: Mapped[str] = mapped_column(String(64), default="lagerleiter", server_default="lagerleiter")
    is_active: Mapped[bool] = mapped_column(Boolean(), default=True, server_default="true", index=True)


class ApprovalRequest(TimestampMixin, Base):
    __tablename__ = "approval_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(32), index=True)
    entity_id: Mapped[int] = mapped_column(Integer(), index=True)
    status: Mapped[str] = mapped_column(String(24), default="pending", server_default="pending", index=True)
    amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text(), nullable=True)
    requested_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    decided_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ApprovalAction(TimestampMixin, Base):
    __tablename__ = "approval_actions"

    id: Mapped[int] = mapped_column(primary_key=True)
    approval_request_id: Mapped[int] = mapped_column(
        ForeignKey("approval_requests.id", ondelete="CASCADE"), index=True
    )
    action: Mapped[str] = mapped_column(String(24), index=True)  # approve | reject
    comment: Mapped[str | None] = mapped_column(Text(), nullable=True)
    acted_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    acted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class Document(TimestampMixin, Base):
    __tablename__ = "documents"
    __table_args__ = (
        UniqueConstraint("entity_type", "entity_id", "document_type", "version", name="uq_documents_entity_doc_version"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(64), index=True)
    entity_id: Mapped[int] = mapped_column(Integer(), index=True)
    document_type: Mapped[str] = mapped_column(String(64), index=True)
    file_name: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(128), index=True)
    file_size: Mapped[int] = mapped_column(Integer())
    storage_path: Mapped[str] = mapped_column(String(512), unique=True)
    version: Mapped[int] = mapped_column(Integer(), default=1, server_default="1")
    uploaded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
