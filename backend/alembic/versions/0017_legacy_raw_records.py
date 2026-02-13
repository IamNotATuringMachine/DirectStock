"""add legacy raw records staging table

Revision ID: 0017_legacy_raw_records
Revises: 0016_legacy_support_records
Create Date: 2026-02-13

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "0017_legacy_raw_records"
down_revision: Union[str, None] = "0016_legacy_support_records"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "legacy_raw_records",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("run_id", sa.Integer(), nullable=True),
        sa.Column("source_table", sa.String(length=128), nullable=False),
        sa.Column("source_file", sa.String(length=255), nullable=False),
        sa.Column("row_key", sa.String(length=255), nullable=False),
        sa.Column("row_key_source", sa.String(length=64), nullable=False, server_default="legacy_id"),
        sa.Column("row_hash", sa.String(length=64), nullable=False),
        sa.Column("source_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("payload_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["run_id"], ["legacy_migration_runs.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source_table", "row_key", name="uq_legacy_raw_records_source_table_row_key"),
    )
    op.create_index("ix_legacy_raw_records_run_id", "legacy_raw_records", ["run_id"])
    op.create_index("ix_legacy_raw_records_source_table", "legacy_raw_records", ["source_table"])
    op.create_index("ix_legacy_raw_records_row_key", "legacy_raw_records", ["row_key"])
    op.create_index("ix_legacy_raw_records_row_hash", "legacy_raw_records", ["row_hash"])
    op.create_index("ix_legacy_raw_records_source_updated_at", "legacy_raw_records", ["source_updated_at"])


def downgrade() -> None:
    op.drop_index("ix_legacy_raw_records_source_updated_at", table_name="legacy_raw_records")
    op.drop_index("ix_legacy_raw_records_row_hash", table_name="legacy_raw_records")
    op.drop_index("ix_legacy_raw_records_row_key", table_name="legacy_raw_records")
    op.drop_index("ix_legacy_raw_records_source_table", table_name="legacy_raw_records")
    op.drop_index("ix_legacy_raw_records_run_id", table_name="legacy_raw_records")
    op.drop_table("legacy_raw_records")
