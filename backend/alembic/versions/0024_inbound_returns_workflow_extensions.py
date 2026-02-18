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

    with op.batch_alter_table("goods_receipts") as batch_op:
        batch_op.add_column(sa.Column("purchase_order_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_goods_receipts_purchase_order_id",
            "purchase_orders",
            ["purchase_order_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index(
            "ix_goods_receipts_purchase_order_id",
            ["purchase_order_id"],
        )

    with op.batch_alter_table("return_orders") as batch_op:
        batch_op.add_column(sa.Column("source_type", sa.String(length=24), nullable=True))
        batch_op.add_column(sa.Column("source_reference", sa.String(length=255), nullable=True))
        batch_op.create_check_constraint(
            "ck_return_orders_source_type",
            "source_type in ('customer','technician') or source_type is null",
        )
        batch_op.create_index(
            "ix_return_orders_source_type",
            ["source_type"],
        )

    with op.batch_alter_table("return_order_items") as batch_op:
        batch_op.add_column(sa.Column("repair_mode", sa.String(length=24), nullable=True))
        batch_op.add_column(sa.Column("external_status", sa.String(length=40), nullable=True))
        batch_op.add_column(sa.Column("external_partner", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("external_dispatched_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("external_returned_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.create_check_constraint(
            "ck_return_order_items_repair_mode",
            "repair_mode in ('internal','external') or repair_mode is null",
        )
        batch_op.create_check_constraint(
            "ck_return_order_items_external_status",
            "external_status in ('waiting_external_provider','at_external_provider','ready_for_use') "
            "or external_status is null",
        )
        batch_op.create_index(
            "ix_return_order_items_repair_mode",
            ["repair_mode"],
        )
        batch_op.create_index(
            "ix_return_order_items_external_status",
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

    with op.batch_alter_table("return_order_items") as batch_op:
        batch_op.drop_index("ix_return_order_items_external_status")
        batch_op.drop_index("ix_return_order_items_repair_mode")
        batch_op.drop_constraint("ck_return_order_items_external_status", type_="check")
        batch_op.drop_constraint("ck_return_order_items_repair_mode", type_="check")
        batch_op.drop_column("external_returned_at")
        batch_op.drop_column("external_dispatched_at")
        batch_op.drop_column("external_partner")
        batch_op.drop_column("external_status")
        batch_op.drop_column("repair_mode")

    with op.batch_alter_table("return_orders") as batch_op:
        batch_op.drop_index("ix_return_orders_source_type")
        batch_op.drop_constraint("ck_return_orders_source_type", type_="check")
        batch_op.drop_column("source_reference")
        batch_op.drop_column("source_type")

    with op.batch_alter_table("goods_receipts") as batch_op:
        batch_op.drop_index("ix_goods_receipts_purchase_order_id")
        batch_op.drop_constraint("fk_goods_receipts_purchase_order_id", type_="foreignkey")
        batch_op.drop_column("purchase_order_id")

    op.drop_index("ix_products_requires_item_tracking", table_name="products")
    op.drop_column("products", "requires_item_tracking")
