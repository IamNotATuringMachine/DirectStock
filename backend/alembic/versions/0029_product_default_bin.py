"""add product default_bin_id

Revision ID: 0029_product_default_bin
Revises: 0028_dhl_express_carrier
Create Date: 2026-02-18

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "0029_product_default_bin"
down_revision: Union[str, None] = "0028_dhl_express_carrier"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column("default_bin_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_products_default_bin_id",
        "products",
        "bin_locations",
        ["default_bin_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_products_default_bin_id", "products", ["default_bin_id"])


def downgrade() -> None:
    op.drop_index("ix_products_default_bin_id", table_name="products")
    op.drop_constraint("fk_products_default_bin_id", "products", type_="foreignkey")
    op.drop_column("products", "default_bin_id")
