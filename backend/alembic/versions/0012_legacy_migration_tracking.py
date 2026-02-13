"""add legacy migration tracking tables

Revision ID: 0012_legacy_migration
Revises: 0011_integration_clients
Create Date: 2026-02-13

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0012_legacy_migration"
down_revision: Union[str, None] = "0011_integration_clients"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "legacy_migration_runs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("run_type", sa.String(length=16), nullable=False),
        sa.Column("domain", sa.String(length=32), nullable=False),
        sa.Column("source_ref", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="running"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("processed_records", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_records", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_records", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_records", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reconciliation_json", sa.JSON(), nullable=True),
        sa.Column("started_by", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["started_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_legacy_migration_runs_run_type", "legacy_migration_runs", ["run_type"])
    op.create_index("ix_legacy_migration_runs_domain", "legacy_migration_runs", ["domain"])
    op.create_index("ix_legacy_migration_runs_status", "legacy_migration_runs", ["status"])
    op.create_index("ix_legacy_migration_runs_started_at", "legacy_migration_runs", ["started_at"])
    op.create_index("ix_legacy_migration_runs_finished_at", "legacy_migration_runs", ["finished_at"])
    op.create_index("ix_legacy_migration_runs_started_by", "legacy_migration_runs", ["started_by"])

    op.create_table(
        "legacy_migration_issues",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("run_id", sa.Integer(), nullable=False),
        sa.Column("domain", sa.String(length=32), nullable=False),
        sa.Column("issue_code", sa.String(length=64), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False, server_default="error"),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("row_reference", sa.String(length=120), nullable=True),
        sa.Column("payload_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["run_id"], ["legacy_migration_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_legacy_migration_issues_run_id", "legacy_migration_issues", ["run_id"])
    op.create_index("ix_legacy_migration_issues_domain", "legacy_migration_issues", ["domain"])
    op.create_index("ix_legacy_migration_issues_issue_code", "legacy_migration_issues", ["issue_code"])
    op.create_index("ix_legacy_migration_issues_severity", "legacy_migration_issues", ["severity"])

    op.create_table(
        "legacy_id_map",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("domain", sa.String(length=32), nullable=False),
        sa.Column("legacy_id", sa.String(length=128), nullable=False),
        sa.Column("directstock_entity", sa.String(length=64), nullable=False),
        sa.Column("directstock_id", sa.Integer(), nullable=False),
        sa.Column("run_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["run_id"], ["legacy_migration_runs.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("domain", "legacy_id", "directstock_entity", name="uq_legacy_id_map_domain_legacy_entity"),
    )
    op.create_index("ix_legacy_id_map_domain", "legacy_id_map", ["domain"])
    op.create_index("ix_legacy_id_map_legacy_id", "legacy_id_map", ["legacy_id"])
    op.create_index("ix_legacy_id_map_directstock_entity", "legacy_id_map", ["directstock_entity"])
    op.create_index("ix_legacy_id_map_directstock_id", "legacy_id_map", ["directstock_id"])
    op.create_index("ix_legacy_id_map_run_id", "legacy_id_map", ["run_id"])


def downgrade() -> None:
    op.drop_index("ix_legacy_id_map_run_id", table_name="legacy_id_map")
    op.drop_index("ix_legacy_id_map_directstock_id", table_name="legacy_id_map")
    op.drop_index("ix_legacy_id_map_directstock_entity", table_name="legacy_id_map")
    op.drop_index("ix_legacy_id_map_legacy_id", table_name="legacy_id_map")
    op.drop_index("ix_legacy_id_map_domain", table_name="legacy_id_map")
    op.drop_table("legacy_id_map")

    op.drop_index("ix_legacy_migration_issues_severity", table_name="legacy_migration_issues")
    op.drop_index("ix_legacy_migration_issues_issue_code", table_name="legacy_migration_issues")
    op.drop_index("ix_legacy_migration_issues_domain", table_name="legacy_migration_issues")
    op.drop_index("ix_legacy_migration_issues_run_id", table_name="legacy_migration_issues")
    op.drop_table("legacy_migration_issues")

    op.drop_index("ix_legacy_migration_runs_started_by", table_name="legacy_migration_runs")
    op.drop_index("ix_legacy_migration_runs_finished_at", table_name="legacy_migration_runs")
    op.drop_index("ix_legacy_migration_runs_started_at", table_name="legacy_migration_runs")
    op.drop_index("ix_legacy_migration_runs_status", table_name="legacy_migration_runs")
    op.drop_index("ix_legacy_migration_runs_domain", table_name="legacy_migration_runs")
    op.drop_index("ix_legacy_migration_runs_run_type", table_name="legacy_migration_runs")
    op.drop_table("legacy_migration_runs")
