"""inbound and returns workflow extensions

Revision ID: 0024_inbound_returns_workflow
Revises: 0023_invoice_exports
Create Date: 2026-02-17

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "0024_inbound_returns_workflow"
down_revision: Union[str, None] = "0023_invoice_exports"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_QUICK_CREATE_PERMISSION = "module.products.quick_create"


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column(
            "requires_item_tracking",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.create_index(
        "ix_products_requires_item_tracking",
        "products",
        ["requires_item_tracking"],
    )

    op.add_column(
        "goods_receipts",
        sa.Column("purchase_order_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_goods_receipts_purchase_order_id",
        "goods_receipts",
        "purchase_orders",
        ["purchase_order_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_goods_receipts_purchase_order_id",
        "goods_receipts",
        ["purchase_order_id"],
    )

    op.add_column(
        "return_orders",
        sa.Column("source_type", sa.String(length=24), nullable=True),
    )
    op.add_column(
        "return_orders",
        sa.Column("source_reference", sa.String(length=255), nullable=True),
    )
    op.create_check_constraint(
        "ck_return_orders_source_type",
        "return_orders",
        "source_type in ('customer','technician') or source_type is null",
    )
    op.create_index(
        "ix_return_orders_source_type",
        "return_orders",
        ["source_type"],
    )

    op.add_column(
        "return_order_items",
        sa.Column("repair_mode", sa.String(length=24), nullable=True),
    )
    op.add_column(
        "return_order_items",
        sa.Column("external_status", sa.String(length=40), nullable=True),
    )
    op.add_column(
        "return_order_items",
        sa.Column("external_partner", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "return_order_items",
        sa.Column("external_dispatched_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "return_order_items",
        sa.Column("external_returned_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint(
        "ck_return_order_items_repair_mode",
        "return_order_items",
        "repair_mode in ('internal','external') or repair_mode is null",
    )
    op.create_check_constraint(
        "ck_return_order_items_external_status",
        "return_order_items",
        "external_status in ('waiting_external_provider','at_external_provider','ready_for_use') "
        "or external_status is null",
    )
    op.create_index(
        "ix_return_order_items_repair_mode",
        "return_order_items",
        ["repair_mode"],
    )
    op.create_index(
        "ix_return_order_items_external_status",
        "return_order_items",
        ["external_status"],
    )

    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            INSERT INTO permissions (code, description, created_at, updated_at)
            VALUES (:code, :description, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (code) DO UPDATE
            SET description = EXCLUDED.description,
                updated_at = CURRENT_TIMESTAMP
            """
        ),
        {
            "code": _QUICK_CREATE_PERMISSION,
            "description": "Create products from goods receipt workflow",
        },
    )
    bind.execute(
        sa.text(
            """
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM roles r
            JOIN permissions p ON p.code = :code
            WHERE r.name = 'admin'
              AND NOT EXISTS (
                SELECT 1
                FROM role_permissions rp
                WHERE rp.role_id = r.id AND rp.permission_id = p.id
              )
            """
        ),
        {"code": _QUICK_CREATE_PERMISSION},
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            DELETE FROM role_permissions
            WHERE permission_id IN (
              SELECT id FROM permissions WHERE code = :code
            )
            """
        ),
        {"code": _QUICK_CREATE_PERMISSION},
    )
    bind.execute(
        sa.text("DELETE FROM permissions WHERE code = :code"),
        {"code": _QUICK_CREATE_PERMISSION},
    )

    op.drop_index("ix_return_order_items_external_status", table_name="return_order_items")
    op.drop_index("ix_return_order_items_repair_mode", table_name="return_order_items")
    op.drop_constraint("ck_return_order_items_external_status", "return_order_items", type_="check")
    op.drop_constraint("ck_return_order_items_repair_mode", "return_order_items", type_="check")
    op.drop_column("return_order_items", "external_returned_at")
    op.drop_column("return_order_items", "external_dispatched_at")
    op.drop_column("return_order_items", "external_partner")
    op.drop_column("return_order_items", "external_status")
    op.drop_column("return_order_items", "repair_mode")

    op.drop_index("ix_return_orders_source_type", table_name="return_orders")
    op.drop_constraint("ck_return_orders_source_type", "return_orders", type_="check")
    op.drop_column("return_orders", "source_reference")
    op.drop_column("return_orders", "source_type")

    op.drop_index("ix_goods_receipts_purchase_order_id", table_name="goods_receipts")
    op.drop_constraint("fk_goods_receipts_purchase_order_id", "goods_receipts", type_="foreignkey")
    op.drop_column("goods_receipts", "purchase_order_id")

    op.drop_index("ix_products_requires_item_tracking", table_name="products")
    op.drop_column("products", "requires_item_tracking")
