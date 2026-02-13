"""add inter warehouse transfer tables

Revision ID: 0014_inter_warehouse
Revises: 0013_shipping_carriers
Create Date: 2026-02-13

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0014_inter_warehouse"
down_revision: Union[str, None] = "0013_shipping_carriers"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "inter_warehouse_transfers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("transfer_number", sa.String(length=64), nullable=False),
        sa.Column("from_warehouse_id", sa.Integer(), nullable=False),
        sa.Column("to_warehouse_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="draft"),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dispatched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("from_warehouse_id <> to_warehouse_id", name="ck_inter_warehouse_transfer_distinct_wh"),
        sa.ForeignKeyConstraint(["from_warehouse_id"], ["warehouses.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["to_warehouse_id"], ["warehouses.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("transfer_number"),
    )
    op.create_index("ix_inter_warehouse_transfers_transfer_number", "inter_warehouse_transfers", ["transfer_number"])
    op.create_index("ix_inter_warehouse_transfers_from_warehouse_id", "inter_warehouse_transfers", ["from_warehouse_id"])
    op.create_index("ix_inter_warehouse_transfers_to_warehouse_id", "inter_warehouse_transfers", ["to_warehouse_id"])
    op.create_index("ix_inter_warehouse_transfers_status", "inter_warehouse_transfers", ["status"])
    op.create_index("ix_inter_warehouse_transfers_created_by", "inter_warehouse_transfers", ["created_by"])

    op.create_table(
        "inter_warehouse_transfer_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("inter_warehouse_transfer_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("from_bin_id", sa.Integer(), nullable=False),
        sa.Column("to_bin_id", sa.Integer(), nullable=False),
        sa.Column("requested_quantity", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("dispatched_quantity", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("received_quantity", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("unit", sa.String(length=20), nullable=False, server_default="piece"),
        sa.Column("batch_number", sa.String(length=64), nullable=True),
        sa.Column("serial_numbers", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["inter_warehouse_transfer_id"], ["inter_warehouse_transfers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["from_bin_id"], ["bin_locations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["to_bin_id"], ["bin_locations.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_inter_warehouse_transfer_items_inter_warehouse_transfer_id", "inter_warehouse_transfer_items", ["inter_warehouse_transfer_id"])
    op.create_index("ix_inter_warehouse_transfer_items_product_id", "inter_warehouse_transfer_items", ["product_id"])
    op.create_index("ix_inter_warehouse_transfer_items_from_bin_id", "inter_warehouse_transfer_items", ["from_bin_id"])
    op.create_index("ix_inter_warehouse_transfer_items_to_bin_id", "inter_warehouse_transfer_items", ["to_bin_id"])
    op.create_index("ix_inter_warehouse_transfer_items_batch_number", "inter_warehouse_transfer_items", ["batch_number"])


def downgrade() -> None:
    op.drop_index("ix_inter_warehouse_transfer_items_batch_number", table_name="inter_warehouse_transfer_items")
    op.drop_index("ix_inter_warehouse_transfer_items_to_bin_id", table_name="inter_warehouse_transfer_items")
    op.drop_index("ix_inter_warehouse_transfer_items_from_bin_id", table_name="inter_warehouse_transfer_items")
    op.drop_index("ix_inter_warehouse_transfer_items_product_id", table_name="inter_warehouse_transfer_items")
    op.drop_index("ix_inter_warehouse_transfer_items_inter_warehouse_transfer_id", table_name="inter_warehouse_transfer_items")
    op.drop_table("inter_warehouse_transfer_items")

    op.drop_index("ix_inter_warehouse_transfers_created_by", table_name="inter_warehouse_transfers")
    op.drop_index("ix_inter_warehouse_transfers_status", table_name="inter_warehouse_transfers")
    op.drop_index("ix_inter_warehouse_transfers_to_warehouse_id", table_name="inter_warehouse_transfers")
    op.drop_index("ix_inter_warehouse_transfers_from_warehouse_id", table_name="inter_warehouse_transfers")
    op.drop_index("ix_inter_warehouse_transfers_transfer_number", table_name="inter_warehouse_transfers")
    op.drop_table("inter_warehouse_transfers")
