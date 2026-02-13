"""add picking and returns

Revision ID: 0009_picking_returns
Revises: 0008_abc_purchase_reco
Create Date: 2026-02-13

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0009_picking_returns"
down_revision: Union[str, None] = "0008_abc_purchase_reco"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "pick_waves",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("wave_number", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("wave_number"),
    )
    op.create_index("ix_pick_waves_wave_number", "pick_waves", ["wave_number"])
    op.create_index("ix_pick_waves_status", "pick_waves", ["status"])
    op.create_index("ix_pick_waves_created_by", "pick_waves", ["created_by"])

    op.create_table(
        "pick_tasks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("pick_wave_id", sa.Integer(), nullable=False),
        sa.Column("goods_issue_id", sa.Integer(), nullable=True),
        sa.Column("goods_issue_item_id", sa.Integer(), nullable=True),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("source_bin_id", sa.Integer(), nullable=True),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("picked_quantity", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("unit", sa.String(length=20), nullable=False, server_default="piece"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
        sa.Column("sequence_no", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("picked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("picked_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["goods_issue_id"], ["goods_issues.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["goods_issue_item_id"], ["goods_issue_items.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["pick_wave_id"], ["pick_waves.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["picked_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["source_bin_id"], ["bin_locations.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_pick_tasks_pick_wave_id", "pick_tasks", ["pick_wave_id"])
    op.create_index("ix_pick_tasks_goods_issue_id", "pick_tasks", ["goods_issue_id"])
    op.create_index("ix_pick_tasks_goods_issue_item_id", "pick_tasks", ["goods_issue_item_id"])
    op.create_index("ix_pick_tasks_product_id", "pick_tasks", ["product_id"])
    op.create_index("ix_pick_tasks_source_bin_id", "pick_tasks", ["source_bin_id"])
    op.create_index("ix_pick_tasks_status", "pick_tasks", ["status"])
    op.create_index("ix_pick_tasks_sequence_no", "pick_tasks", ["sequence_no"])
    op.create_index("ix_pick_tasks_picked_by", "pick_tasks", ["picked_by"])

    op.create_table(
        "return_orders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("return_number", sa.String(length=64), nullable=False),
        sa.Column("customer_id", sa.Integer(), nullable=True),
        sa.Column("goods_issue_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="registered"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("registered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("inspected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["goods_issue_id"], ["goods_issues.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("return_number"),
    )
    op.create_index("ix_return_orders_return_number", "return_orders", ["return_number"])
    op.create_index("ix_return_orders_customer_id", "return_orders", ["customer_id"])
    op.create_index("ix_return_orders_goods_issue_id", "return_orders", ["goods_issue_id"])
    op.create_index("ix_return_orders_status", "return_orders", ["status"])
    op.create_index("ix_return_orders_created_by", "return_orders", ["created_by"])

    op.create_table(
        "return_order_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("return_order_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("unit", sa.String(length=20), nullable=False, server_default="piece"),
        sa.Column("decision", sa.String(length=24), nullable=True),
        sa.Column("target_bin_id", sa.Integer(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["return_order_id"], ["return_orders.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_bin_id"], ["bin_locations.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_return_order_items_return_order_id", "return_order_items", ["return_order_id"])
    op.create_index("ix_return_order_items_product_id", "return_order_items", ["product_id"])
    op.create_index("ix_return_order_items_decision", "return_order_items", ["decision"])
    op.create_index("ix_return_order_items_target_bin_id", "return_order_items", ["target_bin_id"])


def downgrade() -> None:
    op.drop_index("ix_return_order_items_target_bin_id", table_name="return_order_items")
    op.drop_index("ix_return_order_items_decision", table_name="return_order_items")
    op.drop_index("ix_return_order_items_product_id", table_name="return_order_items")
    op.drop_index("ix_return_order_items_return_order_id", table_name="return_order_items")
    op.drop_table("return_order_items")

    op.drop_index("ix_return_orders_created_by", table_name="return_orders")
    op.drop_index("ix_return_orders_status", table_name="return_orders")
    op.drop_index("ix_return_orders_goods_issue_id", table_name="return_orders")
    op.drop_index("ix_return_orders_customer_id", table_name="return_orders")
    op.drop_index("ix_return_orders_return_number", table_name="return_orders")
    op.drop_table("return_orders")

    op.drop_index("ix_pick_tasks_picked_by", table_name="pick_tasks")
    op.drop_index("ix_pick_tasks_sequence_no", table_name="pick_tasks")
    op.drop_index("ix_pick_tasks_status", table_name="pick_tasks")
    op.drop_index("ix_pick_tasks_source_bin_id", table_name="pick_tasks")
    op.drop_index("ix_pick_tasks_product_id", table_name="pick_tasks")
    op.drop_index("ix_pick_tasks_goods_issue_item_id", table_name="pick_tasks")
    op.drop_index("ix_pick_tasks_goods_issue_id", table_name="pick_tasks")
    op.drop_index("ix_pick_tasks_pick_wave_id", table_name="pick_tasks")
    op.drop_table("pick_tasks")

    op.drop_index("ix_pick_waves_created_by", table_name="pick_waves")
    op.drop_index("ix_pick_waves_status", table_name="pick_waves")
    op.drop_index("ix_pick_waves_wave_number", table_name="pick_waves")
    op.drop_table("pick_waves")
