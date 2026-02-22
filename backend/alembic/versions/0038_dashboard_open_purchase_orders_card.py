"""add dashboard card for open purchase orders

Revision ID: 0038_dashboard_open_purchase_orders_card
Revises: 0037_purchase_email_profiles
Create Date: 2026-02-21

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0038_dashboard_open_purchase_orders_card"
down_revision: Union[str, None] = "0037_purchase_email_profiles"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


CARD_KEY = "open-purchase-orders"


def upgrade() -> None:
    connection = op.get_bind()

    exists = connection.execute(
        sa.text("SELECT 1 FROM dashboard_cards WHERE card_key = :card_key LIMIT 1"),
        {"card_key": CARD_KEY},
    ).first()

    if exists is None:
        connection.execute(
            sa.text(
                """
                INSERT INTO dashboard_cards (
                    card_key,
                    title,
                    description,
                    default_order,
                    is_active,
                    created_at,
                    updated_at
                ) VALUES (
                    :card_key,
                    :title,
                    :description,
                    :default_order,
                    :is_active,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
                """
            ),
            {
                "card_key": CARD_KEY,
                "title": "Offene Bestellungen",
                "description": "Bestellungen ohne Abschluss",
                "default_order": 80,
                "is_active": True,
            },
        )


def downgrade() -> None:
    connection = op.get_bind()
    connection.execute(sa.text("DELETE FROM user_dashboard_configs WHERE card_key = :card_key"), {"card_key": CARD_KEY})
    connection.execute(sa.text("DELETE FROM role_dashboard_policies WHERE card_key = :card_key"), {"card_key": CARD_KEY})
    connection.execute(sa.text("DELETE FROM dashboard_cards WHERE card_key = :card_key"), {"card_key": CARD_KEY})
