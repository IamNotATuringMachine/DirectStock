from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, JSON, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Inventory(TimestampMixin, Base):
    __tablename__ = "inventory"
    __table_args__ = (UniqueConstraint("product_id", "bin_location_id", name="uq_inventory_product_bin"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    bin_location_id: Mapped[int] = mapped_column(ForeignKey("bin_locations.id", ondelete="CASCADE"), index=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0, server_default="0")
    reserved_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0, server_default="0")
    unit: Mapped[str] = mapped_column(String(20), default="piece", server_default="piece")


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id: Mapped[int] = mapped_column(primary_key=True)
    movement_type: Mapped[str] = mapped_column(String(32), index=True)
    reference_type: Mapped[str | None] = mapped_column(String(50), index=True)
    reference_number: Mapped[str | None] = mapped_column(String(100), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), index=True)
    from_bin_id: Mapped[int | None] = mapped_column(
        ForeignKey("bin_locations.id", ondelete="SET NULL"), nullable=True, index=True
    )
    to_bin_id: Mapped[int | None] = mapped_column(
        ForeignKey("bin_locations.id", ondelete="SET NULL"), nullable=True, index=True
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3))
    performed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    performed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class GoodsReceipt(TimestampMixin, Base):
    __tablename__ = "goods_receipts"

    id: Mapped[int] = mapped_column(primary_key=True)
    receipt_number: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    supplier_id: Mapped[int | None] = mapped_column(
        ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    purchase_order_id: Mapped[int | None] = mapped_column(
        ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True, index=True
    )
    mode: Mapped[str] = mapped_column(String(20), default="po", server_default="po", index=True)
    source_type: Mapped[str] = mapped_column(String(20), default="supplier", server_default="supplier", index=True)
    status: Mapped[str] = mapped_column(String(20), default="draft", server_default="draft", index=True)
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    notes: Mapped[str | None] = mapped_column(Text())


class GoodsReceiptItem(TimestampMixin, Base):
    __tablename__ = "goods_receipt_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    goods_receipt_id: Mapped[int] = mapped_column(ForeignKey("goods_receipts.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), index=True)
    expected_quantity: Mapped[Decimal | None] = mapped_column(Numeric(14, 3), nullable=True)
    received_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0, server_default="0")
    unit: Mapped[str] = mapped_column(String(20), default="piece", server_default="piece")
    target_bin_id: Mapped[int | None] = mapped_column(
        ForeignKey("bin_locations.id", ondelete="SET NULL"), nullable=True, index=True
    )
    batch_number: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    expiry_date: Mapped[date | None] = mapped_column(Date(), nullable=True, index=True)
    manufactured_at: Mapped[date | None] = mapped_column(Date(), nullable=True)
    serial_numbers: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    purchase_order_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("purchase_order_items.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    input_method: Mapped[str] = mapped_column(String(20), default="manual", server_default="manual")
    condition: Mapped[str] = mapped_column(String(20), default="new", server_default="new")


class GoodsIssue(TimestampMixin, Base):
    __tablename__ = "goods_issues"

    id: Mapped[int] = mapped_column(primary_key=True)
    issue_number: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    customer_id: Mapped[int | None] = mapped_column(
        ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    customer_location_id: Mapped[int | None] = mapped_column(
        ForeignKey("customer_locations.id", ondelete="SET NULL"), nullable=True, index=True
    )
    customer_reference: Mapped[str | None] = mapped_column(String(100), index=True)
    status: Mapped[str] = mapped_column(String(20), default="draft", server_default="draft", index=True)
    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    notes: Mapped[str | None] = mapped_column(Text())


class GoodsIssueItem(TimestampMixin, Base):
    __tablename__ = "goods_issue_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    goods_issue_id: Mapped[int] = mapped_column(ForeignKey("goods_issues.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), index=True)
    requested_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3))
    issued_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0, server_default="0")
    unit: Mapped[str] = mapped_column(String(20), default="piece", server_default="piece")
    source_bin_id: Mapped[int | None] = mapped_column(
        ForeignKey("bin_locations.id", ondelete="SET NULL"), nullable=True, index=True
    )
    batch_number: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    use_fefo: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    serial_numbers: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)


class StockTransfer(TimestampMixin, Base):
    __tablename__ = "stock_transfers"

    id: Mapped[int] = mapped_column(primary_key=True)
    transfer_number: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default="draft", server_default="draft", index=True)
    transferred_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    notes: Mapped[str | None] = mapped_column(Text())


class StockTransferItem(TimestampMixin, Base):
    __tablename__ = "stock_transfer_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    stock_transfer_id: Mapped[int] = mapped_column(
        ForeignKey("stock_transfers.id", ondelete="CASCADE"), index=True
    )
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), index=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3))
    unit: Mapped[str] = mapped_column(String(20), default="piece", server_default="piece")
    from_bin_id: Mapped[int] = mapped_column(ForeignKey("bin_locations.id", ondelete="RESTRICT"), index=True)
    to_bin_id: Mapped[int] = mapped_column(ForeignKey("bin_locations.id", ondelete="RESTRICT"), index=True)
    batch_number: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    serial_numbers: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)


class InventoryBatch(TimestampMixin, Base):
    __tablename__ = "inventory_batches"
    __table_args__ = (
        UniqueConstraint("product_id", "bin_location_id", "batch_number", name="uq_inventory_batches_product_bin_batch"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    bin_location_id: Mapped[int] = mapped_column(ForeignKey("bin_locations.id", ondelete="CASCADE"), index=True)
    batch_number: Mapped[str] = mapped_column(String(64), index=True)
    expiry_date: Mapped[date | None] = mapped_column(Date(), nullable=True, index=True)
    manufactured_at: Mapped[date | None] = mapped_column(Date(), nullable=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0, server_default="0")
    unit: Mapped[str] = mapped_column(String(20), default="piece", server_default="piece")


class SerialNumber(TimestampMixin, Base):
    __tablename__ = "serial_numbers"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    serial_number: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    batch_id: Mapped[int | None] = mapped_column(
        ForeignKey("inventory_batches.id", ondelete="SET NULL"), nullable=True, index=True
    )
    current_bin_id: Mapped[int | None] = mapped_column(
        ForeignKey("bin_locations.id", ondelete="SET NULL"), nullable=True, index=True
    )
    status: Mapped[str] = mapped_column(String(20), default="in_stock", server_default="in_stock", index=True)
    last_movement_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)


class InventoryCountSession(TimestampMixin, Base):
    __tablename__ = "inventory_count_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_number: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    session_type: Mapped[str] = mapped_column(String(20), index=True)  # snapshot | cycle
    status: Mapped[str] = mapped_column(String(20), default="draft", server_default="draft", index=True)
    warehouse_id: Mapped[int | None] = mapped_column(
        ForeignKey("warehouses.id", ondelete="SET NULL"), nullable=True, index=True
    )
    tolerance_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0, server_default="0")
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    notes: Mapped[str | None] = mapped_column(Text())


class InventoryCountItem(TimestampMixin, Base):
    __tablename__ = "inventory_count_items"
    __table_args__ = (
        UniqueConstraint(
            "session_id",
            "product_id",
            "bin_location_id",
            name="uq_inventory_count_items_session_product_bin",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_count_sessions.id", ondelete="CASCADE"), index=True
    )
    inventory_id: Mapped[int | None] = mapped_column(
        ForeignKey("inventory.id", ondelete="SET NULL"), nullable=True, index=True
    )
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), index=True)
    bin_location_id: Mapped[int] = mapped_column(ForeignKey("bin_locations.id", ondelete="RESTRICT"), index=True)
    snapshot_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0, server_default="0")
    counted_quantity: Mapped[Decimal | None] = mapped_column(Numeric(14, 3), nullable=True)
    difference_quantity: Mapped[Decimal | None] = mapped_column(Numeric(14, 3), nullable=True)
    unit: Mapped[str] = mapped_column(String(20), default="piece", server_default="piece")
    count_attempts: Mapped[int] = mapped_column(default=0, server_default="0")
    recount_required: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", index=True)
    last_counted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    counted_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
