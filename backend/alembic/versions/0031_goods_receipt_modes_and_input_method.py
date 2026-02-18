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
    op.add_column(
        "goods_receipts",
        sa.Column("mode", sa.String(length=20), nullable=False, server_default="po"),
    )
    op.add_column(
        "goods_receipts",
        sa.Column("source_type", sa.String(length=20), nullable=False, server_default="supplier"),
    )
    op.create_index("ix_goods_receipts_mode", "goods_receipts", ["mode"])
    op.create_index("ix_goods_receipts_source_type", "goods_receipts", ["source_type"])
    op.create_check_constraint(
        "ck_goods_receipts_mode",
        "goods_receipts",
        "mode in ('po','free')",
    )
    op.create_check_constraint(
        "ck_goods_receipts_source_type",
        "goods_receipts",
        "source_type in ('supplier','technician','other')",
    )

    op.add_column(
        "goods_receipt_items",
        sa.Column("input_method", sa.String(length=20), nullable=False, server_default="manual"),
    )
    op.create_check_constraint(
        "ck_goods_receipt_items_input_method",
        "goods_receipt_items",
        "input_method in ('scan','manual')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_goods_receipt_items_input_method", "goods_receipt_items", type_="check")
    op.drop_column("goods_receipt_items", "input_method")

    op.drop_constraint("ck_goods_receipts_source_type", "goods_receipts", type_="check")
    op.drop_constraint("ck_goods_receipts_mode", "goods_receipts", type_="check")
    op.drop_index("ix_goods_receipts_source_type", table_name="goods_receipts")
    op.drop_index("ix_goods_receipts_mode", table_name="goods_receipts")
    op.drop_column("goods_receipts", "source_type")
    op.drop_column("goods_receipts", "mode")
