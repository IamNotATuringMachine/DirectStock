"""add integration clients and access logs

Revision ID: 0011_integration_clients
Revises: 0010_workflows_docs_audit
Create Date: 2026-02-13

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0011_integration_clients"
down_revision: Union[str, None] = "0010_workflows_docs_audit"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "integration_clients",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("client_id", sa.String(length=120), nullable=False),
        sa.Column("secret_hash", sa.String(length=255), nullable=False),
        sa.Column("scopes_json", sa.JSON(), nullable=False),
        sa.Column("token_ttl_minutes", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("secret_rotated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
        sa.UniqueConstraint("client_id"),
    )
    op.create_index("ix_integration_clients_name", "integration_clients", ["name"])
    op.create_index("ix_integration_clients_client_id", "integration_clients", ["client_id"])
    op.create_index("ix_integration_clients_is_active", "integration_clients", ["is_active"])
    op.create_index("ix_integration_clients_last_used_at", "integration_clients", ["last_used_at"])
    op.create_index("ix_integration_clients_created_by", "integration_clients", ["created_by"])

    op.create_table(
        "integration_access_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("integration_client_id", sa.Integer(), nullable=True),
        sa.Column("endpoint", sa.String(length=255), nullable=False),
        sa.Column("method", sa.String(length=8), nullable=False),
        sa.Column("scope", sa.String(length=100), nullable=True),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("request_id", sa.String(length=64), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["integration_client_id"], ["integration_clients.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_integration_access_logs_integration_client_id", "integration_access_logs", ["integration_client_id"])
    op.create_index("ix_integration_access_logs_endpoint", "integration_access_logs", ["endpoint"])
    op.create_index("ix_integration_access_logs_method", "integration_access_logs", ["method"])
    op.create_index("ix_integration_access_logs_scope", "integration_access_logs", ["scope"])
    op.create_index("ix_integration_access_logs_status_code", "integration_access_logs", ["status_code"])
    op.create_index("ix_integration_access_logs_request_id", "integration_access_logs", ["request_id"])
    op.create_index("ix_integration_access_logs_used_at", "integration_access_logs", ["used_at"])


def downgrade() -> None:
    op.drop_index("ix_integration_access_logs_used_at", table_name="integration_access_logs")
    op.drop_index("ix_integration_access_logs_request_id", table_name="integration_access_logs")
    op.drop_index("ix_integration_access_logs_status_code", table_name="integration_access_logs")
    op.drop_index("ix_integration_access_logs_scope", table_name="integration_access_logs")
    op.drop_index("ix_integration_access_logs_method", table_name="integration_access_logs")
    op.drop_index("ix_integration_access_logs_endpoint", table_name="integration_access_logs")
    op.drop_index("ix_integration_access_logs_integration_client_id", table_name="integration_access_logs")
    op.drop_table("integration_access_logs")

    op.drop_index("ix_integration_clients_created_by", table_name="integration_clients")
    op.drop_index("ix_integration_clients_last_used_at", table_name="integration_clients")
    op.drop_index("ix_integration_clients_is_active", table_name="integration_clients")
    op.drop_index("ix_integration_clients_client_id", table_name="integration_clients")
    op.drop_index("ix_integration_clients_name", table_name="integration_clients")
    op.drop_table("integration_clients")
