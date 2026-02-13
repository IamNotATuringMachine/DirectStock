"""add abc classification and purchase recommendations

Revision ID: 0008_abc_purchase_reco
Revises: 0007_po_item_link
Create Date: 2026-02-13

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0008_abc_purchase_reco"
down_revision: Union[str, None] = "0007_po_item_link"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "abc_classification_runs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("date_from", sa.Date(), nullable=False),
        sa.Column("date_to", sa.Date(), nullable=False),
        sa.Column("total_outbound_quantity", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("generated_by", sa.Integer(), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["generated_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_abc_classification_runs_date_from", "abc_classification_runs", ["date_from"])
    op.create_index("ix_abc_classification_runs_date_to", "abc_classification_runs", ["date_to"])
    op.create_index("ix_abc_classification_runs_generated_by", "abc_classification_runs", ["generated_by"])
    op.create_index("ix_abc_classification_runs_generated_at", "abc_classification_runs", ["generated_at"])

    op.create_table(
        "abc_classification_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("run_id", sa.Integer(), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("outbound_quantity", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("share_percent", sa.Numeric(8, 2), nullable=False, server_default="0"),
        sa.Column("cumulative_share_percent", sa.Numeric(8, 2), nullable=False, server_default="0"),
        sa.Column("category", sa.String(length=1), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["run_id"], ["abc_classification_runs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("run_id", "product_id", name="uq_abc_classification_items_run_product"),
    )
    op.create_index("ix_abc_classification_items_run_id", "abc_classification_items", ["run_id"])
    op.create_index("ix_abc_classification_items_rank", "abc_classification_items", ["rank"])
    op.create_index("ix_abc_classification_items_product_id", "abc_classification_items", ["product_id"])
    op.create_index("ix_abc_classification_items_category", "abc_classification_items", ["category"])

    op.create_table(
        "purchase_recommendations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("warehouse_id", sa.Integer(), nullable=True),
        sa.Column("supplier_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="open"),
        sa.Column("target_stock", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("on_hand_quantity", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("open_po_quantity", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("deficit_quantity", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("recommended_quantity", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("min_order_quantity", sa.Numeric(14, 3), nullable=False, server_default="1"),
        sa.Column("converted_purchase_order_id", sa.Integer(), nullable=True),
        sa.Column("generated_by", sa.Integer(), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["converted_purchase_order_id"], ["purchase_orders.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["generated_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["warehouse_id"], ["warehouses.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_purchase_recommendations_product_id", "purchase_recommendations", ["product_id"])
    op.create_index("ix_purchase_recommendations_warehouse_id", "purchase_recommendations", ["warehouse_id"])
    op.create_index("ix_purchase_recommendations_supplier_id", "purchase_recommendations", ["supplier_id"])
    op.create_index("ix_purchase_recommendations_status", "purchase_recommendations", ["status"])
    op.create_index("ix_purchase_recommendations_generated_at", "purchase_recommendations", ["generated_at"])
    op.create_index("ix_purchase_recommendations_generated_by", "purchase_recommendations", ["generated_by"])
    op.create_index(
        "ix_purchase_recommendations_converted_purchase_order_id",
        "purchase_recommendations",
        ["converted_purchase_order_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_purchase_recommendations_converted_purchase_order_id", table_name="purchase_recommendations")
    op.drop_index("ix_purchase_recommendations_generated_by", table_name="purchase_recommendations")
    op.drop_index("ix_purchase_recommendations_generated_at", table_name="purchase_recommendations")
    op.drop_index("ix_purchase_recommendations_status", table_name="purchase_recommendations")
    op.drop_index("ix_purchase_recommendations_supplier_id", table_name="purchase_recommendations")
    op.drop_index("ix_purchase_recommendations_warehouse_id", table_name="purchase_recommendations")
    op.drop_index("ix_purchase_recommendations_product_id", table_name="purchase_recommendations")
    op.drop_table("purchase_recommendations")

    op.drop_index("ix_abc_classification_items_category", table_name="abc_classification_items")
    op.drop_index("ix_abc_classification_items_product_id", table_name="abc_classification_items")
    op.drop_index("ix_abc_classification_items_rank", table_name="abc_classification_items")
    op.drop_index("ix_abc_classification_items_run_id", table_name="abc_classification_items")
    op.drop_table("abc_classification_items")

    op.drop_index("ix_abc_classification_runs_generated_at", table_name="abc_classification_runs")
    op.drop_index("ix_abc_classification_runs_generated_by", table_name="abc_classification_runs")
    op.drop_index("ix_abc_classification_runs_date_to", table_name="abc_classification_runs")
    op.drop_index("ix_abc_classification_runs_date_from", table_name="abc_classification_runs")
    op.drop_table("abc_classification_runs")
