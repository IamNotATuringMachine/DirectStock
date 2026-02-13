"""add inventory count sessions and items

Revision ID: 0005_inventory_counts
Revises: 0004_batch_and_serial_tracking
Create Date: 2026-02-13

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0005_inventory_counts"
down_revision: Union[str, None] = "0004_batch_and_serial_tracking"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "inventory_count_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("session_number", sa.String(length=64), nullable=False),
        sa.Column("session_type", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("warehouse_id", sa.Integer(), nullable=True),
        sa.Column("tolerance_quantity", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["warehouse_id"], ["warehouses.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("session_number", name="uq_inventory_count_sessions_session_number"),
    )
    op.create_index("ix_inventory_count_sessions_session_number", "inventory_count_sessions", ["session_number"])
    op.create_index("ix_inventory_count_sessions_session_type", "inventory_count_sessions", ["session_type"])
    op.create_index("ix_inventory_count_sessions_status", "inventory_count_sessions", ["status"])
    op.create_index("ix_inventory_count_sessions_warehouse_id", "inventory_count_sessions", ["warehouse_id"])

    op.create_table(
        "inventory_count_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("inventory_id", sa.Integer(), nullable=True),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("bin_location_id", sa.Integer(), nullable=False),
        sa.Column("snapshot_quantity", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("counted_quantity", sa.Numeric(14, 3), nullable=True),
        sa.Column("difference_quantity", sa.Numeric(14, 3), nullable=True),
        sa.Column("unit", sa.String(length=20), nullable=False, server_default="piece"),
        sa.Column("count_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("recount_required", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("last_counted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("counted_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["session_id"], ["inventory_count_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["inventory_id"], ["inventory.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["bin_location_id"], ["bin_locations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["counted_by"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint(
            "session_id",
            "product_id",
            "bin_location_id",
            name="uq_inventory_count_items_session_product_bin",
        ),
    )
    op.create_index("ix_inventory_count_items_session_id", "inventory_count_items", ["session_id"])
    op.create_index("ix_inventory_count_items_inventory_id", "inventory_count_items", ["inventory_id"])
    op.create_index("ix_inventory_count_items_product_id", "inventory_count_items", ["product_id"])
    op.create_index("ix_inventory_count_items_bin_location_id", "inventory_count_items", ["bin_location_id"])
    op.create_index("ix_inventory_count_items_recount_required", "inventory_count_items", ["recount_required"])
    op.create_index("ix_inventory_count_items_counted_by", "inventory_count_items", ["counted_by"])


def downgrade() -> None:
    op.drop_index("ix_inventory_count_items_counted_by", table_name="inventory_count_items")
    op.drop_index("ix_inventory_count_items_recount_required", table_name="inventory_count_items")
    op.drop_index("ix_inventory_count_items_bin_location_id", table_name="inventory_count_items")
    op.drop_index("ix_inventory_count_items_product_id", table_name="inventory_count_items")
    op.drop_index("ix_inventory_count_items_inventory_id", table_name="inventory_count_items")
    op.drop_index("ix_inventory_count_items_session_id", table_name="inventory_count_items")
    op.drop_table("inventory_count_items")

    op.drop_index("ix_inventory_count_sessions_warehouse_id", table_name="inventory_count_sessions")
    op.drop_index("ix_inventory_count_sessions_status", table_name="inventory_count_sessions")
    op.drop_index("ix_inventory_count_sessions_session_type", table_name="inventory_count_sessions")
    op.drop_index("ix_inventory_count_sessions_session_number", table_name="inventory_count_sessions")
    op.drop_table("inventory_count_sessions")
