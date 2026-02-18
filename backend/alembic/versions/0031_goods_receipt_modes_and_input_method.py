"""add goods receipt mode/source type and item input_method

Revision ID: 0031_goods_receipt_modes_input
Revises: 0030_goods_receipt_item_condition
Create Date: 2026-02-18

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "0031_goods_receipt_modes_input"
down_revision: Union[str, None] = "0030_goods_receipt_item_condition"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("goods_receipts") as batch_op:
        batch_op.add_column(sa.Column("mode", sa.String(length=20), nullable=False, server_default="po"))
        batch_op.add_column(
            sa.Column("source_type", sa.String(length=20), nullable=False, server_default="supplier")
        )
        batch_op.create_index("ix_goods_receipts_mode", ["mode"])
        batch_op.create_index("ix_goods_receipts_source_type", ["source_type"])
        batch_op.create_check_constraint(
            "ck_goods_receipts_mode",
            "mode in ('po','free')",
        )
        batch_op.create_check_constraint(
            "ck_goods_receipts_source_type",
            "source_type in ('supplier','technician','other')",
        )

    with op.batch_alter_table("goods_receipt_items") as batch_op:
        batch_op.add_column(sa.Column("input_method", sa.String(length=20), nullable=False, server_default="manual"))
        batch_op.create_check_constraint(
            "ck_goods_receipt_items_input_method",
            "input_method in ('scan','manual')",
        )


def downgrade() -> None:
    with op.batch_alter_table("goods_receipt_items") as batch_op:
        batch_op.drop_constraint("ck_goods_receipt_items_input_method", type_="check")
        batch_op.drop_column("input_method")

    with op.batch_alter_table("goods_receipts") as batch_op:
        batch_op.drop_constraint("ck_goods_receipts_source_type", type_="check")
        batch_op.drop_constraint("ck_goods_receipts_mode", type_="check")
        batch_op.drop_index("ix_goods_receipts_source_type")
        batch_op.drop_index("ix_goods_receipts_mode")
        batch_op.drop_column("source_type")
        batch_op.drop_column("mode")
