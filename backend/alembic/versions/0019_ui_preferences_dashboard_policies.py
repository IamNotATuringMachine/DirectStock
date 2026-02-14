"""phase5 ui preferences and dashboard policies

Revision ID: 0019_ui_dashboard_policies
Revises: 0018_rbac_permissions_pages
Create Date: 2026-02-14

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "0019_ui_dashboard_policies"
down_revision: Union[str, None] = "0018_rbac_permissions_pages"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


DEFAULT_CARDS: list[tuple[str, str, str, int]] = [
    ("summary", "Zusammenfassung", "Kernmetriken", 10),
    ("capacity", "Kapazität", "Lagerplatzauslastung", 20),
    ("quick-actions", "Quick Actions", "Schnellzugriffe", 30),
    ("recent-movements", "Letzte Bewegungen", "Neueste Bewegungsbuchungen", 40),
    ("low-stock", "Niedrige Bestände", "Kritische Bestände", 50),
    ("activity-today", "Aktivität heute", "Tagesaktivität", 60),
    ("critical-alerts", "Kritische Alerts", "Offene kritische Alerts", 70),
]


def upgrade() -> None:
    op.create_table(
        "user_ui_preferences",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("theme", sa.String(length=12), nullable=False, server_default="system"),
        sa.Column("compact_mode", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("show_help", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_user_ui_preferences_user_id"),
    )
    op.create_index("ix_user_ui_preferences_user_id", "user_ui_preferences", ["user_id"])

    op.create_table(
        "dashboard_cards",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("card_key", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("default_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("card_key", name="uq_dashboard_cards_card_key"),
    )
    op.create_index("ix_dashboard_cards_card_key", "dashboard_cards", ["card_key"])

    op.create_table(
        "role_dashboard_policies",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("role_id", sa.Integer(), nullable=False),
        sa.Column("card_key", sa.String(length=100), nullable=False),
        sa.Column("allowed", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("default_visible", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("locked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("role_id", "card_key", name="uq_role_dashboard_policies_role_card"),
    )
    op.create_index("ix_role_dashboard_policies_role_id", "role_dashboard_policies", ["role_id"])
    op.create_index("ix_role_dashboard_policies_card_key", "role_dashboard_policies", ["card_key"])

    op.create_table(
        "user_dashboard_configs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("card_key", sa.String(length=100), nullable=False),
        sa.Column("visible", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "card_key", name="uq_user_dashboard_configs_user_card"),
    )
    op.create_index("ix_user_dashboard_configs_user_id", "user_dashboard_configs", ["user_id"])
    op.create_index("ix_user_dashboard_configs_card_key", "user_dashboard_configs", ["card_key"])

    bind = op.get_bind()
    for card_key, title, description, default_order in DEFAULT_CARDS:
        bind.execute(
            sa.text(
                """
                INSERT INTO dashboard_cards (card_key, title, description, default_order, is_active, created_at, updated_at)
                VALUES (:card_key, :title, :description, :default_order, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (card_key) DO UPDATE
                SET title = EXCLUDED.title,
                    description = EXCLUDED.description,
                    default_order = EXCLUDED.default_order,
                    is_active = EXCLUDED.is_active,
                    updated_at = CURRENT_TIMESTAMP
                """
            ),
            {
                "card_key": card_key,
                "title": title,
                "description": description,
                "default_order": default_order,
            },
        )

    role_rows = list(bind.execute(sa.text("SELECT id FROM roles")))
    for row in role_rows:
        for card_key, _, _, _ in DEFAULT_CARDS:
            bind.execute(
                sa.text(
                    """
                    INSERT INTO role_dashboard_policies (role_id, card_key, allowed, default_visible, locked, created_at, updated_at)
                    VALUES (:role_id, :card_key, true, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ON CONFLICT (role_id, card_key) DO UPDATE
                    SET allowed = EXCLUDED.allowed,
                        default_visible = EXCLUDED.default_visible,
                        locked = EXCLUDED.locked,
                        updated_at = CURRENT_TIMESTAMP
                    """
                ),
                {"role_id": row.id, "card_key": card_key},
            )


def downgrade() -> None:
    op.drop_index("ix_user_dashboard_configs_card_key", table_name="user_dashboard_configs")
    op.drop_index("ix_user_dashboard_configs_user_id", table_name="user_dashboard_configs")
    op.drop_table("user_dashboard_configs")

    op.drop_index("ix_role_dashboard_policies_card_key", table_name="role_dashboard_policies")
    op.drop_index("ix_role_dashboard_policies_role_id", table_name="role_dashboard_policies")
    op.drop_table("role_dashboard_policies")

    op.drop_index("ix_dashboard_cards_card_key", table_name="dashboard_cards")
    op.drop_table("dashboard_cards")

    op.drop_index("ix_user_ui_preferences_user_id", table_name="user_ui_preferences")
    op.drop_table("user_ui_preferences")
