"""purchase email sender profiles and recipient defaults

Revision ID: 0037_purchase_email_profiles
Revises: 0036_purchase_email_settings
Create Date: 2026-02-21

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0037_purchase_email_profiles"
down_revision: Union[str, None] = "0036_purchase_email_settings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "purchase_email_settings",
        sa.Column("profile_name", sa.String(length=120), nullable=False, server_default="Standard"),
    )
    op.add_column(
        "purchase_email_settings",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "purchase_email_settings",
        sa.Column("default_to_addresses", sa.Text(), nullable=True),
    )
    op.add_column(
        "purchase_email_settings",
        sa.Column("default_cc_addresses", sa.Text(), nullable=True),
    )

    op.create_index("ix_purchase_email_settings_is_active", "purchase_email_settings", ["is_active"], unique=False)

    op.execute("UPDATE purchase_email_settings SET is_active = false")
    op.execute(
        """
        UPDATE purchase_email_settings
        SET is_active = true
        WHERE id = (
            SELECT id FROM purchase_email_settings ORDER BY id ASC LIMIT 1
        )
        """
    )


def downgrade() -> None:
    op.drop_index("ix_purchase_email_settings_is_active", table_name="purchase_email_settings")
    op.drop_column("purchase_email_settings", "default_cc_addresses")
    op.drop_column("purchase_email_settings", "default_to_addresses")
    op.drop_column("purchase_email_settings", "is_active")
    op.drop_column("purchase_email_settings", "profile_name")
