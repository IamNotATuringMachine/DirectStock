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
    bind = op.get_bind()
    if bind.dialect.name in {"postgresql", "mysql"}:
        op.alter_column(
            "alembic_version",
            "version_num",
            type_=sa.String(length=64),
            existing_type=sa.String(length=32),
            existing_nullable=False,
        )

    with op.batch_alter_table("goods_receipt_items") as batch_op:
        batch_op.add_column(sa.Column("condition", sa.String(20), nullable=False, server_default="new"))
        batch_op.create_check_constraint(
            "ck_gri_condition",
            "condition in ('new','defective','needs_repair')",
        )


def downgrade() -> None:
    with op.batch_alter_table("goods_receipt_items") as batch_op:
        batch_op.drop_constraint("ck_gri_condition", type_="check")
        batch_op.drop_column("condition")
