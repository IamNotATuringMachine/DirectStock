from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, JSON, Numeric, String, Text, UniqueConstraint, func
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


class GoodsIssue(TimestampMixin, Base):
    __tablename__ = "goods_issues"

    id: Mapped[int] = mapped_column(primary_key=True)
    issue_number: Mapped[str] = mapped_column(String(64), unique=True, index=True)
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
