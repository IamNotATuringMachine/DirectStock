"""add alert rules and events

Revision ID: 0006_alert_rules_and_events
Revises: 0005_inventory_counts
Create Date: 2026-02-13

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0006_alert_rules_and_events"
down_revision: Union[str, None] = "0005_inventory_counts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "alert_rules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("rule_type", sa.String(length=30), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False, server_default="medium"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("product_id", sa.Integer(), nullable=True),
        sa.Column("warehouse_id", sa.Integer(), nullable=True),
        sa.Column("threshold_quantity", sa.Numeric(14, 3), nullable=True),
        sa.Column("expiry_days", sa.Integer(), nullable=True),
        sa.Column("dedupe_window_minutes", sa.Integer(), nullable=False, server_default="1440"),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["warehouse_id"], ["warehouses.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_alert_rules_name", "alert_rules", ["name"])
    op.create_index("ix_alert_rules_rule_type", "alert_rules", ["rule_type"])
    op.create_index("ix_alert_rules_severity", "alert_rules", ["severity"])
    op.create_index("ix_alert_rules_is_active", "alert_rules", ["is_active"])
    op.create_index("ix_alert_rules_product_id", "alert_rules", ["product_id"])
    op.create_index("ix_alert_rules_warehouse_id", "alert_rules", ["warehouse_id"])

    op.create_table(
        "alert_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("rule_id", sa.Integer(), nullable=True),
        sa.Column("alert_type", sa.String(length=30), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("source_key", sa.String(length=255), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=True),
        sa.Column("warehouse_id", sa.Integer(), nullable=True),
        sa.Column("bin_location_id", sa.Integer(), nullable=True),
        sa.Column("batch_id", sa.Integer(), nullable=True),
        sa.Column("triggered_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("acknowledged_by", sa.Integer(), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["rule_id"], ["alert_rules.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["warehouse_id"], ["warehouses.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["bin_location_id"], ["bin_locations.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["batch_id"], ["inventory_batches.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["acknowledged_by"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_alert_events_rule_id", "alert_events", ["rule_id"])
    op.create_index("ix_alert_events_alert_type", "alert_events", ["alert_type"])
    op.create_index("ix_alert_events_severity", "alert_events", ["severity"])
    op.create_index("ix_alert_events_status", "alert_events", ["status"])
    op.create_index("ix_alert_events_source_key", "alert_events", ["source_key"])
    op.create_index("ix_alert_events_product_id", "alert_events", ["product_id"])
    op.create_index("ix_alert_events_warehouse_id", "alert_events", ["warehouse_id"])
    op.create_index("ix_alert_events_bin_location_id", "alert_events", ["bin_location_id"])
    op.create_index("ix_alert_events_batch_id", "alert_events", ["batch_id"])
    op.create_index("ix_alert_events_triggered_at", "alert_events", ["triggered_at"])
    op.create_index("ix_alert_events_acknowledged_at", "alert_events", ["acknowledged_at"])
    op.create_index("ix_alert_events_acknowledged_by", "alert_events", ["acknowledged_by"])


def downgrade() -> None:
    op.drop_index("ix_alert_events_acknowledged_by", table_name="alert_events")
    op.drop_index("ix_alert_events_acknowledged_at", table_name="alert_events")
    op.drop_index("ix_alert_events_triggered_at", table_name="alert_events")
    op.drop_index("ix_alert_events_batch_id", table_name="alert_events")
    op.drop_index("ix_alert_events_bin_location_id", table_name="alert_events")
    op.drop_index("ix_alert_events_warehouse_id", table_name="alert_events")
    op.drop_index("ix_alert_events_product_id", table_name="alert_events")
    op.drop_index("ix_alert_events_source_key", table_name="alert_events")
    op.drop_index("ix_alert_events_status", table_name="alert_events")
    op.drop_index("ix_alert_events_severity", table_name="alert_events")
    op.drop_index("ix_alert_events_alert_type", table_name="alert_events")
    op.drop_index("ix_alert_events_rule_id", table_name="alert_events")
    op.drop_table("alert_events")

    op.drop_index("ix_alert_rules_warehouse_id", table_name="alert_rules")
    op.drop_index("ix_alert_rules_product_id", table_name="alert_rules")
    op.drop_index("ix_alert_rules_is_active", table_name="alert_rules")
    op.drop_index("ix_alert_rules_severity", table_name="alert_rules")
    op.drop_index("ix_alert_rules_rule_type", table_name="alert_rules")
    op.drop_index("ix_alert_rules_name", table_name="alert_rules")
    op.drop_table("alert_rules")
