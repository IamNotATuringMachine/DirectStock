"""add require_operator_selection to operation signoff settings

Revision ID: 0040_signoff_settings_require_operator_selection
Revises: 0039_tablet_operations_signoff
Create Date: 2026-02-22

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0040_signoff_settings_require_operator_selection"
down_revision: Union[str, None] = "0039_tablet_operations_signoff"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "operation_signoff_settings",
        sa.Column("require_operator_selection", sa.Boolean(), server_default=sa.text("true"), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("operation_signoff_settings", "require_operator_selection")
