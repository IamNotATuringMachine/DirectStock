"""tablet operations operator directory and signoff tables

Revision ID: 0039_tablet_operations_signoff
Revises: 0038_dashboard_open_purchase_orders_card
Create Date: 2026-02-21

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0039_tablet_operations_signoff"
down_revision: Union[str, None] = "0038_dashboard_open_purchase_orders_card"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "warehouse_operators",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("pin_hash", sa.Text(), nullable=True),
        sa.Column("pin_enabled", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("display_name"),
    )
    op.create_index("ix_warehouse_operators_is_active", "warehouse_operators", ["is_active"], unique=False)
    op.create_index("ix_warehouse_operators_pin_enabled", "warehouse_operators", ["pin_enabled"], unique=False)
    op.create_index("ix_warehouse_operators_created_by", "warehouse_operators", ["created_by"], unique=False)
    op.create_index("ix_warehouse_operators_updated_by", "warehouse_operators", ["updated_by"], unique=False)

    op.create_table(
        "operation_signoff_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("require_pin", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("pin_session_ttl_minutes", sa.Integer(), server_default="480", nullable=False),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_operation_signoff_settings_updated_by", "operation_signoff_settings", ["updated_by"], unique=False)

    op.create_table(
        "operation_signoffs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("operation_type", sa.String(length=40), nullable=False),
        sa.Column("operation_id", sa.Integer(), nullable=False),
        sa.Column("operator_id", sa.Integer(), nullable=True),
        sa.Column("operator_name_snapshot", sa.String(length=120), nullable=False),
        sa.Column("signature_payload_json", sa.JSON(), nullable=False),
        sa.Column("pin_verified", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("pin_session_token_id", sa.String(length=64), nullable=True),
        sa.Column("device_context_json", sa.JSON(), nullable=True),
        sa.Column("recorded_by_user_id", sa.Integer(), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["operator_id"], ["warehouse_operators.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["recorded_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("operation_type", "operation_id", name="uq_operation_signoffs_type_id"),
    )
    op.create_index("ix_operation_signoffs_operation_type", "operation_signoffs", ["operation_type"], unique=False)
    op.create_index("ix_operation_signoffs_operation_id", "operation_signoffs", ["operation_id"], unique=False)
    op.create_index("ix_operation_signoffs_operator_id", "operation_signoffs", ["operator_id"], unique=False)
    op.create_index("ix_operation_signoffs_pin_verified", "operation_signoffs", ["pin_verified"], unique=False)
    op.create_index("ix_operation_signoffs_pin_session_token_id", "operation_signoffs", ["pin_session_token_id"], unique=False)
    op.create_index("ix_operation_signoffs_recorded_by_user_id", "operation_signoffs", ["recorded_by_user_id"], unique=False)
    op.create_index("ix_operation_signoffs_recorded_at", "operation_signoffs", ["recorded_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_operation_signoffs_recorded_at", table_name="operation_signoffs")
    op.drop_index("ix_operation_signoffs_recorded_by_user_id", table_name="operation_signoffs")
    op.drop_index("ix_operation_signoffs_pin_session_token_id", table_name="operation_signoffs")
    op.drop_index("ix_operation_signoffs_pin_verified", table_name="operation_signoffs")
    op.drop_index("ix_operation_signoffs_operator_id", table_name="operation_signoffs")
    op.drop_index("ix_operation_signoffs_operation_id", table_name="operation_signoffs")
    op.drop_index("ix_operation_signoffs_operation_type", table_name="operation_signoffs")
    op.drop_table("operation_signoffs")

    op.drop_index("ix_operation_signoff_settings_updated_by", table_name="operation_signoff_settings")
    op.drop_table("operation_signoff_settings")

    op.drop_index("ix_warehouse_operators_updated_by", table_name="warehouse_operators")
    op.drop_index("ix_warehouse_operators_created_by", table_name="warehouse_operators")
    op.drop_index("ix_warehouse_operators_pin_enabled", table_name="warehouse_operators")
    op.drop_index("ix_warehouse_operators_is_active", table_name="warehouse_operators")
    op.drop_table("warehouse_operators")
