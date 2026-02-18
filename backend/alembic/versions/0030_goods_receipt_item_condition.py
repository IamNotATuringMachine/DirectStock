"""add goods_receipt_items condition

Revision ID: 0030_goods_receipt_item_condition
Revises: 0029_product_default_bin
Create Date: 2026-02-18

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "0030_goods_receipt_item_condition"
down_revision: Union[str, None] = "0029_product_default_bin"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "goods_receipt_items",
        sa.Column("condition", sa.String(20), nullable=False, server_default="new"),
    )
    op.create_check_constraint(
        "ck_gri_condition",
        "goods_receipt_items",
        "condition in ('new','defective','needs_repair')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_gri_condition", "goods_receipt_items", type_="check")
    op.drop_column("goods_receipt_items", "condition")
