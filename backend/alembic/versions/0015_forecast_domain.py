"""add forecast tables

Revision ID: 0015_forecast_domain
Revises: 0014_inter_warehouse
Create Date: 2026-02-13

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0015_forecast_domain"
down_revision: Union[str, None] = "0014_inter_warehouse"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "forecast_runs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("date_from", sa.Date(), nullable=False),
        sa.Column("date_to", sa.Date(), nullable=False),
        sa.Column("lookback_days", sa.Integer(), nullable=False, server_default="56"),
        sa.Column("horizon_days_json", sa.JSON(), nullable=False),
        sa.Column("algorithm_version", sa.String(length=32), nullable=False, server_default="sma-v1"),
        sa.Column("generated_by", sa.Integer(), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["generated_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_forecast_runs_date_from", "forecast_runs", ["date_from"])
    op.create_index("ix_forecast_runs_date_to", "forecast_runs", ["date_to"])
    op.create_index("ix_forecast_runs_generated_by", "forecast_runs", ["generated_by"])
    op.create_index("ix_forecast_runs_generated_at", "forecast_runs", ["generated_at"])

    op.create_table(
        "forecast_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("run_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("warehouse_id", sa.Integer(), nullable=True),
        sa.Column("historical_mean", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("trend_slope", sa.Numeric(14, 6), nullable=False, server_default="0"),
        sa.Column("confidence_score", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("history_days_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("forecast_qty_7", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("forecast_qty_30", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("forecast_qty_90", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["run_id"], ["forecast_runs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["warehouse_id"], ["warehouses.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("run_id", "product_id", "warehouse_id", name="uq_forecast_items_run_product_warehouse"),
    )
    op.create_index("ix_forecast_items_run_id", "forecast_items", ["run_id"])
    op.create_index("ix_forecast_items_product_id", "forecast_items", ["product_id"])
    op.create_index("ix_forecast_items_warehouse_id", "forecast_items", ["warehouse_id"])


def downgrade() -> None:
    op.drop_index("ix_forecast_items_warehouse_id", table_name="forecast_items")
    op.drop_index("ix_forecast_items_product_id", table_name="forecast_items")
    op.drop_index("ix_forecast_items_run_id", table_name="forecast_items")
    op.drop_table("forecast_items")

    op.drop_index("ix_forecast_runs_generated_at", table_name="forecast_runs")
    op.drop_index("ix_forecast_runs_generated_by", table_name="forecast_runs")
    op.drop_index("ix_forecast_runs_date_to", table_name="forecast_runs")
    op.drop_index("ix_forecast_runs_date_from", table_name="forecast_runs")
    op.drop_table("forecast_runs")
