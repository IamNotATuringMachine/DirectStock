"""add legacy support records

Revision ID: 0016_legacy_support_records
Revises: 0015_forecast_domain
Create Date: 2026-02-13

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "0016_legacy_support_records"
down_revision: Union[str, None] = "0015_forecast_domain"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "legacy_support_records",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("run_id", sa.Integer(), nullable=True),
        sa.Column("record_type", sa.String(length=64), nullable=False),
        sa.Column("legacy_id", sa.String(length=128), nullable=False),
        sa.Column("source_table", sa.String(length=128), nullable=False),
        sa.Column("record_key", sa.String(length=128), nullable=False),
        sa.Column("record_value", sa.Text(), nullable=True),
        sa.Column("status_code", sa.String(length=64), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("payload_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["run_id"], ["legacy_migration_runs.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("record_type", "legacy_id", name="uq_legacy_support_record_type_legacy_id"),
    )
    op.create_index("ix_legacy_support_records_run_id", "legacy_support_records", ["run_id"])
    op.create_index("ix_legacy_support_records_record_type", "legacy_support_records", ["record_type"])
    op.create_index("ix_legacy_support_records_legacy_id", "legacy_support_records", ["legacy_id"])
    op.create_index("ix_legacy_support_records_source_table", "legacy_support_records", ["source_table"])
    op.create_index("ix_legacy_support_records_record_key", "legacy_support_records", ["record_key"])
    op.create_index("ix_legacy_support_records_status_code", "legacy_support_records", ["status_code"])


def downgrade() -> None:
    op.drop_index("ix_legacy_support_records_status_code", table_name="legacy_support_records")
    op.drop_index("ix_legacy_support_records_record_key", table_name="legacy_support_records")
    op.drop_index("ix_legacy_support_records_source_table", table_name="legacy_support_records")
    op.drop_index("ix_legacy_support_records_legacy_id", table_name="legacy_support_records")
    op.drop_index("ix_legacy_support_records_record_type", table_name="legacy_support_records")
    op.drop_index("ix_legacy_support_records_run_id", table_name="legacy_support_records")
    op.drop_table("legacy_support_records")
