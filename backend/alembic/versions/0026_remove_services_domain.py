"""remove services domain and service sales-order paths

Revision ID: 0026_remove_services_domain
Revises: 0025_customer_locations_contacts
Create Date: 2026-02-17

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "0026_remove_services_domain"
down_revision: Union[str, None] = "0025_customer_locations_contacts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_REMOVED_PERMISSION_CODES = (
    "page.services.view",
    "module.services.read",
    "module.services.write",
)


def upgrade() -> None:
    bind = op.get_bind()

    bind.execute(
        sa.text(
            """
            DELETE FROM role_permissions
            WHERE permission_id IN (
                SELECT id FROM permissions WHERE code IN :codes
            )
            """
        ).bindparams(sa.bindparam("codes", expanding=True)),
        {"codes": list(_REMOVED_PERMISSION_CODES)},
    )
    bind.execute(
        sa.text("DELETE FROM permissions WHERE code IN :codes").bindparams(sa.bindparam("codes", expanding=True)),
        {"codes": list(_REMOVED_PERMISSION_CODES)},
    )
    bind.execute(sa.text("DELETE FROM app_pages WHERE slug = 'services'"))

    # Requested data strategy: service entities and service order-items are removed.
    bind.execute(sa.text("DELETE FROM sales_order_items WHERE item_type = 'service' OR service_id IS NOT NULL"))
    bind.execute(sa.text("DELETE FROM services"))

    with op.batch_alter_table("sales_order_items") as batch_op:
        batch_op.drop_index("ix_sales_order_items_service_id")
        batch_op.drop_constraint("sales_order_items_item_type_valid", type_="check")
        batch_op.drop_column("service_id")
        batch_op.create_check_constraint("sales_order_items_item_type_valid", "item_type in ('product')")

    op.drop_index("ix_services_status", table_name="services")
    op.drop_index("ix_services_name", table_name="services")
    op.drop_index("ix_services_service_number", table_name="services")
    op.drop_table("services")


def downgrade() -> None:
    op.create_table(
        "services",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("service_number", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("net_price", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("vat_rate", sa.Numeric(5, 2), nullable=False, server_default="19"),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="EUR"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("vat_rate in (0, 7, 19)", name="services_vat_rate_de"),
        sa.CheckConstraint("status in ('active','blocked','archived')", name="services_status_valid"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("service_number", name="uq_services_service_number"),
    )
    op.create_index("ix_services_service_number", "services", ["service_number"])
    op.create_index("ix_services_name", "services", ["name"])
    op.create_index("ix_services_status", "services", ["status"])

    with op.batch_alter_table("sales_order_items") as batch_op:
        batch_op.drop_constraint("sales_order_items_item_type_valid", type_="check")
        batch_op.add_column(sa.Column("service_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_sales_order_items_service_id_services",
            "services",
            ["service_id"],
            ["id"],
            ondelete="RESTRICT",
        )
        batch_op.create_index("ix_sales_order_items_service_id", ["service_id"])
        batch_op.create_check_constraint("sales_order_items_item_type_valid", "item_type in ('product','service')")

    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            INSERT INTO app_pages (slug, title, description, created_at, updated_at)
            VALUES ('services', 'Dienstleistungen', 'Service-Katalog', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (slug) DO UPDATE
            SET title = EXCLUDED.title,
                description = EXCLUDED.description,
                updated_at = CURRENT_TIMESTAMP
            """
        )
    )

    permission_payload = [
        ("page.services.view", "View access for page 'services'"),
        ("module.services.read", "Read services"),
        ("module.services.write", "Write services"),
    ]
    for code, description in permission_payload:
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
            {"code": code, "description": description},
        )

    role_permission_map: dict[str, tuple[str, ...]] = {
        "admin": ("page.services.view", "module.services.read", "module.services.write"),
        "lagerleiter": ("page.services.view", "module.services.read", "module.services.write"),
        "einkauf": ("page.services.view", "module.services.read"),
        "versand": ("page.services.view", "module.services.read"),
        "controller": ("page.services.view", "module.services.read"),
        "auditor": ("module.services.read",),
    }
    for role_name, codes in role_permission_map.items():
        bind.execute(
            sa.text(
                """
                INSERT INTO role_permissions (role_id, permission_id)
                SELECT r.id, p.id
                FROM roles r
                JOIN permissions p ON p.code IN :codes
                WHERE r.name = :role_name
                  AND NOT EXISTS (
                    SELECT 1 FROM role_permissions rp
                    WHERE rp.role_id = r.id AND rp.permission_id = p.id
                  )
                """
            ).bindparams(sa.bindparam("codes", expanding=True)),
            {"role_name": role_name, "codes": list(codes)},
        )
