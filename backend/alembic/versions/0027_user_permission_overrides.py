"""user permission overrides

Revision ID: 0027_user_permission_overrides
Revises: 0026_remove_services_domain
Create Date: 2026-02-17

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "0027_user_permission_overrides"
down_revision: Union[str, None] = "0026_remove_services_domain"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_permission_overrides",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("permission_id", sa.Integer(), nullable=False),
        sa.Column("effect", sa.String(length=10), nullable=False),
        sa.CheckConstraint("effect in ('allow','deny')", name="ck_user_permission_overrides_effect"),
        sa.ForeignKeyConstraint(["permission_id"], ["permissions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "permission_id", name="pk_user_permission_overrides"),
    )
    op.create_index(
        "ix_user_permission_overrides_user_id",
        "user_permission_overrides",
        ["user_id"],
    )
    op.create_index(
        "ix_user_permission_overrides_permission_id",
        "user_permission_overrides",
        ["permission_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_user_permission_overrides_permission_id", table_name="user_permission_overrides")
    op.drop_index("ix_user_permission_overrides_user_id", table_name="user_permission_overrides")
    op.drop_table("user_permission_overrides")
