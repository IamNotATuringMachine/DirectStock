"""link goods receipt items to purchase order items

Revision ID: 0007_po_item_link
Revises: 0006_alert_rules_and_events
Create Date: 2026-02-13

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0007_po_item_link"
down_revision: Union[str, None] = "0006_alert_rules_and_events"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("goods_receipt_items") as batch_op:
        batch_op.add_column(sa.Column("purchase_order_item_id", sa.Integer(), nullable=True))
        batch_op.create_index("ix_goods_receipt_items_purchase_order_item_id", ["purchase_order_item_id"])
        batch_op.create_foreign_key(
            "fk_goods_receipt_items_purchase_order_item_id",
            "purchase_order_items",
            ["purchase_order_item_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("goods_receipt_items") as batch_op:
        batch_op.drop_constraint("fk_goods_receipt_items_purchase_order_item_id", type_="foreignkey")
        batch_op.drop_index("ix_goods_receipt_items_purchase_order_item_id")
        batch_op.drop_column("purchase_order_item_id")
