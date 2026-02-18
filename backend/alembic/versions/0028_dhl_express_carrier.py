"""add dhl express carrier option

Revision ID: 0028_dhl_express_carrier
Revises: 0027_user_permission_overrides
Create Date: 2026-02-18

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "0028_dhl_express_carrier"
down_revision: Union[str, None] = "0027_user_permission_overrides"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("shipments") as batch_op:
        batch_op.drop_constraint("ck_shipments_carrier_valid", type_="check")
        batch_op.create_check_constraint(
            "ck_shipments_carrier_valid",
            "carrier in ('dhl','dhl_express','dpd','ups')",
        )


def downgrade() -> None:
    with op.batch_alter_table("shipments") as batch_op:
        batch_op.drop_constraint("ck_shipments_carrier_valid", type_="check")
        batch_op.create_check_constraint(
            "ck_shipments_carrier_valid",
            "carrier in ('dhl','dpd','ups')",
        )
