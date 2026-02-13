"""add batch and serial tracking

Revision ID: 0004_batch_and_serial_tracking
Revises: 0003_client_operation_log
Create Date: 2026-02-13

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0004_batch_and_serial_tracking"
down_revision: Union[str, None] = "0003_client_operation_log"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "inventory_batches",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("bin_location_id", sa.Integer(), nullable=False),
        sa.Column("batch_number", sa.String(length=64), nullable=False),
        sa.Column("expiry_date", sa.Date(), nullable=True),
        sa.Column("manufactured_at", sa.Date(), nullable=True),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("unit", sa.String(length=20), nullable=False, server_default="piece"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["bin_location_id"], ["bin_locations.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("product_id", "bin_location_id", "batch_number", name="uq_inventory_batches_product_bin_batch"),
    )
    op.create_index("ix_inventory_batches_product_id", "inventory_batches", ["product_id"])
    op.create_index("ix_inventory_batches_bin_location_id", "inventory_batches", ["bin_location_id"])
    op.create_index("ix_inventory_batches_batch_number", "inventory_batches", ["batch_number"])
    op.create_index("ix_inventory_batches_expiry_date", "inventory_batches", ["expiry_date"])

    op.create_table(
        "serial_numbers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("serial_number", sa.String(length=128), nullable=False),
        sa.Column("batch_id", sa.Integer(), nullable=True),
        sa.Column("current_bin_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="in_stock"),
        sa.Column("last_movement_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["batch_id"], ["inventory_batches.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["current_bin_id"], ["bin_locations.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("serial_number", name="uq_serial_numbers_serial_number"),
    )
    op.create_index("ix_serial_numbers_product_id", "serial_numbers", ["product_id"])
    op.create_index("ix_serial_numbers_serial_number", "serial_numbers", ["serial_number"])
    op.create_index("ix_serial_numbers_batch_id", "serial_numbers", ["batch_id"])
    op.create_index("ix_serial_numbers_current_bin_id", "serial_numbers", ["current_bin_id"])
    op.create_index("ix_serial_numbers_status", "serial_numbers", ["status"])
    op.create_index("ix_serial_numbers_last_movement_at", "serial_numbers", ["last_movement_at"])

    with op.batch_alter_table("goods_receipt_items") as batch_op:
        batch_op.add_column(sa.Column("batch_number", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("expiry_date", sa.Date(), nullable=True))
        batch_op.add_column(sa.Column("manufactured_at", sa.Date(), nullable=True))
        batch_op.add_column(sa.Column("serial_numbers", sa.JSON(), nullable=True))
        batch_op.create_index("ix_goods_receipt_items_batch_number", ["batch_number"])
        batch_op.create_index("ix_goods_receipt_items_expiry_date", ["expiry_date"])

    with op.batch_alter_table("goods_issue_items") as batch_op:
        batch_op.add_column(sa.Column("batch_number", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("use_fefo", sa.Boolean(), nullable=False, server_default=sa.text("false")))
        batch_op.add_column(sa.Column("serial_numbers", sa.JSON(), nullable=True))
        batch_op.create_index("ix_goods_issue_items_batch_number", ["batch_number"])

    with op.batch_alter_table("stock_transfer_items") as batch_op:
        batch_op.add_column(sa.Column("batch_number", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("serial_numbers", sa.JSON(), nullable=True))
        batch_op.create_index("ix_stock_transfer_items_batch_number", ["batch_number"])


def downgrade() -> None:
    with op.batch_alter_table("stock_transfer_items") as batch_op:
        batch_op.drop_index("ix_stock_transfer_items_batch_number")
        batch_op.drop_column("serial_numbers")
        batch_op.drop_column("batch_number")

    with op.batch_alter_table("goods_issue_items") as batch_op:
        batch_op.drop_index("ix_goods_issue_items_batch_number")
        batch_op.drop_column("serial_numbers")
        batch_op.drop_column("use_fefo")
        batch_op.drop_column("batch_number")

    with op.batch_alter_table("goods_receipt_items") as batch_op:
        batch_op.drop_index("ix_goods_receipt_items_expiry_date")
        batch_op.drop_index("ix_goods_receipt_items_batch_number")
        batch_op.drop_column("serial_numbers")
        batch_op.drop_column("manufactured_at")
        batch_op.drop_column("expiry_date")
        batch_op.drop_column("batch_number")

    op.drop_index("ix_serial_numbers_last_movement_at", table_name="serial_numbers")
    op.drop_index("ix_serial_numbers_status", table_name="serial_numbers")
    op.drop_index("ix_serial_numbers_current_bin_id", table_name="serial_numbers")
    op.drop_index("ix_serial_numbers_batch_id", table_name="serial_numbers")
    op.drop_index("ix_serial_numbers_serial_number", table_name="serial_numbers")
    op.drop_index("ix_serial_numbers_product_id", table_name="serial_numbers")
    op.drop_table("serial_numbers")

    op.drop_index("ix_inventory_batches_expiry_date", table_name="inventory_batches")
    op.drop_index("ix_inventory_batches_batch_number", table_name="inventory_batches")
    op.drop_index("ix_inventory_batches_bin_location_id", table_name="inventory_batches")
    op.drop_index("ix_inventory_batches_product_id", table_name="inventory_batches")
    op.drop_table("inventory_batches")
