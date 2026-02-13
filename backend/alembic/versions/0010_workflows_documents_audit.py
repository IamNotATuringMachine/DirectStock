"""add workflows, documents and audit v2 columns

Revision ID: 0010_workflows_docs_audit
Revises: 0009_picking_returns
Create Date: 2026-02-13

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0010_workflows_docs_audit"
down_revision: Union[str, None] = "0009_picking_returns"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "approval_rules",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("entity_type", sa.String(length=32), nullable=False),
        sa.Column("min_amount", sa.Numeric(14, 2), nullable=True),
        sa.Column("required_role", sa.String(length=64), nullable=False, server_default="lagerleiter"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_approval_rules_name", "approval_rules", ["name"])
    op.create_index("ix_approval_rules_entity_type", "approval_rules", ["entity_type"])
    op.create_index("ix_approval_rules_is_active", "approval_rules", ["is_active"])

    op.create_table(
        "approval_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("entity_type", sa.String(length=32), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="pending"),
        sa.Column("amount", sa.Numeric(14, 2), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("requested_by", sa.Integer(), nullable=True),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("decided_by", sa.Integer(), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["requested_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["decided_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_approval_requests_entity_type", "approval_requests", ["entity_type"])
    op.create_index("ix_approval_requests_entity_id", "approval_requests", ["entity_id"])
    op.create_index("ix_approval_requests_status", "approval_requests", ["status"])
    op.create_index("ix_approval_requests_requested_by", "approval_requests", ["requested_by"])
    op.create_index("ix_approval_requests_requested_at", "approval_requests", ["requested_at"])
    op.create_index("ix_approval_requests_decided_by", "approval_requests", ["decided_by"])

    op.create_table(
        "approval_actions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("approval_request_id", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(length=24), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("acted_by", sa.Integer(), nullable=True),
        sa.Column("acted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["approval_request_id"], ["approval_requests.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["acted_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_approval_actions_approval_request_id", "approval_actions", ["approval_request_id"])
    op.create_index("ix_approval_actions_action", "approval_actions", ["action"])
    op.create_index("ix_approval_actions_acted_by", "approval_actions", ["acted_by"])
    op.create_index("ix_approval_actions_acted_at", "approval_actions", ["acted_at"])

    op.create_table(
        "documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("entity_type", sa.String(length=64), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.Column("document_type", sa.String(length=64), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=128), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("storage_path", sa.String(length=512), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("uploaded_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("entity_type", "entity_id", "document_type", "version", name="uq_documents_entity_doc_version"),
        sa.UniqueConstraint("storage_path"),
    )
    op.create_index("ix_documents_entity_type", "documents", ["entity_type"])
    op.create_index("ix_documents_entity_id", "documents", ["entity_id"])
    op.create_index("ix_documents_document_type", "documents", ["document_type"])
    op.create_index("ix_documents_mime_type", "documents", ["mime_type"])
    op.create_index("ix_documents_uploaded_by", "documents", ["uploaded_by"])

    with op.batch_alter_table("audit_log") as batch_op:
        batch_op.add_column(sa.Column("endpoint", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("method", sa.String(length=8), nullable=True))
        batch_op.add_column(sa.Column("changed_fields", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("entity_snapshot_before", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("entity_snapshot_after", sa.JSON(), nullable=True))
        batch_op.create_index("ix_audit_log_endpoint", ["endpoint"])
        batch_op.create_index("ix_audit_log_method", ["method"])


def downgrade() -> None:
    with op.batch_alter_table("audit_log") as batch_op:
        batch_op.drop_index("ix_audit_log_method")
        batch_op.drop_index("ix_audit_log_endpoint")
        batch_op.drop_column("entity_snapshot_after")
        batch_op.drop_column("entity_snapshot_before")
        batch_op.drop_column("changed_fields")
        batch_op.drop_column("method")
        batch_op.drop_column("endpoint")

    op.drop_index("ix_documents_uploaded_by", table_name="documents")
    op.drop_index("ix_documents_mime_type", table_name="documents")
    op.drop_index("ix_documents_document_type", table_name="documents")
    op.drop_index("ix_documents_entity_id", table_name="documents")
    op.drop_index("ix_documents_entity_type", table_name="documents")
    op.drop_table("documents")

    op.drop_index("ix_approval_actions_acted_at", table_name="approval_actions")
    op.drop_index("ix_approval_actions_acted_by", table_name="approval_actions")
    op.drop_index("ix_approval_actions_action", table_name="approval_actions")
    op.drop_index("ix_approval_actions_approval_request_id", table_name="approval_actions")
    op.drop_table("approval_actions")

    op.drop_index("ix_approval_requests_decided_by", table_name="approval_requests")
    op.drop_index("ix_approval_requests_requested_at", table_name="approval_requests")
    op.drop_index("ix_approval_requests_requested_by", table_name="approval_requests")
    op.drop_index("ix_approval_requests_status", table_name="approval_requests")
    op.drop_index("ix_approval_requests_entity_id", table_name="approval_requests")
    op.drop_index("ix_approval_requests_entity_type", table_name="approval_requests")
    op.drop_table("approval_requests")

    op.drop_index("ix_approval_rules_is_active", table_name="approval_rules")
    op.drop_index("ix_approval_rules_entity_type", table_name="approval_rules")
    op.drop_index("ix_approval_rules_name", table_name="approval_rules")
    op.drop_table("approval_rules")
