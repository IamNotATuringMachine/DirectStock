"""purchase email settings table

Revision ID: 0036_purchase_email_settings
Revises: 0035_purchase_order_email_workflow
Create Date: 2026-02-21

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0036_purchase_email_settings"
down_revision: Union[str, None] = "0035_purchase_order_email_workflow"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "purchase_email_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("smtp_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("smtp_host", sa.String(length=255), nullable=True),
        sa.Column("smtp_port", sa.Integer(), nullable=False, server_default="587"),
        sa.Column("smtp_username", sa.String(length=255), nullable=True),
        sa.Column("smtp_password", sa.Text(), nullable=True),
        sa.Column("smtp_use_tls", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("from_address", sa.String(length=255), nullable=False, server_default="einkauf@directstock.local"),
        sa.Column(
            "reply_to_address",
            sa.String(length=255),
            nullable=False,
            server_default="einkauf@directstock.local",
        ),
        sa.Column("sender_name", sa.String(length=255), nullable=False, server_default="Einkauf"),
        sa.Column("imap_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("imap_host", sa.String(length=255), nullable=True),
        sa.Column("imap_port", sa.Integer(), nullable=False, server_default="993"),
        sa.Column("imap_username", sa.String(length=255), nullable=True),
        sa.Column("imap_password", sa.Text(), nullable=True),
        sa.Column("imap_mailbox", sa.String(length=255), nullable=False, server_default="INBOX"),
        sa.Column("imap_use_ssl", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("poll_interval_seconds", sa.Integer(), nullable=False, server_default="300"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )


def downgrade() -> None:
    op.drop_table("purchase_email_settings")
