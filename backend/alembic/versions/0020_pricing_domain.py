"""phase5 pricing domain

Revision ID: 0020_pricing_domain
Revises: 0019_ui_preferences_dashboard_policies
Create Date: 2026-02-14

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "0020_pricing_domain"
down_revision: Union[str, None] = "0019_ui_dashboard_policies"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "product_base_prices",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("net_price", sa.Numeric(14, 2), nullable=False),
        sa.Column("vat_rate", sa.Numeric(5, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="EUR"),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("valid_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("vat_rate in (0, 7, 19)", name="product_base_prices_vat_rate_de"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_product_base_prices_product_id", "product_base_prices", ["product_id"])
    op.create_index("ix_product_base_prices_currency", "product_base_prices", ["currency"])
    op.create_index("ix_product_base_prices_valid_from", "product_base_prices", ["valid_from"])
    op.create_index("ix_product_base_prices_valid_to", "product_base_prices", ["valid_to"])

    op.create_table(
        "customer_product_prices",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("customer_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("net_price", sa.Numeric(14, 2), nullable=False),
        sa.Column("vat_rate", sa.Numeric(5, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="EUR"),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=False),
        sa.Column("valid_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("vat_rate in (0, 7, 19)", name="customer_product_prices_vat_rate_de"),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_customer_product_prices_customer_id", "customer_product_prices", ["customer_id"])
    op.create_index("ix_customer_product_prices_product_id", "customer_product_prices", ["product_id"])
    op.create_index("ix_customer_product_prices_currency", "customer_product_prices", ["currency"])
    op.create_index("ix_customer_product_prices_valid_from", "customer_product_prices", ["valid_from"])
    op.create_index("ix_customer_product_prices_valid_to", "customer_product_prices", ["valid_to"])


def downgrade() -> None:
    op.drop_index("ix_customer_product_prices_valid_to", table_name="customer_product_prices")
    op.drop_index("ix_customer_product_prices_valid_from", table_name="customer_product_prices")
    op.drop_index("ix_customer_product_prices_currency", table_name="customer_product_prices")
    op.drop_index("ix_customer_product_prices_product_id", table_name="customer_product_prices")
    op.drop_index("ix_customer_product_prices_customer_id", table_name="customer_product_prices")
    op.drop_table("customer_product_prices")

    op.drop_index("ix_product_base_prices_valid_to", table_name="product_base_prices")
    op.drop_index("ix_product_base_prices_valid_from", table_name="product_base_prices")
    op.drop_index("ix_product_base_prices_currency", table_name="product_base_prices")
    op.drop_index("ix_product_base_prices_product_id", table_name="product_base_prices")
    op.drop_table("product_base_prices")
