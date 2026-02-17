"""customer hierarchy with locations and contacts

Revision ID: 0025_customer_locations_contacts
Revises: 0024_inbound_returns_workflow
Create Date: 2026-02-17

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "0025_customer_locations_contacts"
down_revision: Union[str, None] = "0024_inbound_returns_workflow"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "customer_locations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("customer_id", sa.Integer(), nullable=False),
        sa.Column("location_code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("street", sa.String(length=255), nullable=True),
        sa.Column("house_number", sa.String(length=32), nullable=True),
        sa.Column("address_line2", sa.String(length=255), nullable=True),
        sa.Column("postal_code", sa.String(length=32), nullable=True),
        sa.Column("city", sa.String(length=128), nullable=True),
        sa.Column("country_code", sa.String(length=2), nullable=False, server_default=sa.text("'DE'")),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("customer_id", "location_code", name="uq_customer_locations_customer_location_code"),
    )
    op.create_index("ix_customer_locations_customer_id", "customer_locations", ["customer_id"])
    op.create_index("ix_customer_locations_name", "customer_locations", ["name"])
    op.create_index("ix_customer_locations_postal_code", "customer_locations", ["postal_code"])
    op.create_index("ix_customer_locations_city", "customer_locations", ["city"])

    op.create_table(
        "customer_contacts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("customer_id", sa.Integer(), nullable=False),
        sa.Column("customer_location_id", sa.Integer(), nullable=True),
        sa.Column("job_title", sa.String(length=128), nullable=True),
        sa.Column("salutation", sa.String(length=64), nullable=True),
        sa.Column("first_name", sa.String(length=128), nullable=False),
        sa.Column("last_name", sa.String(length=128), nullable=False),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["customer_location_id"], ["customer_locations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_customer_contacts_customer_id", "customer_contacts", ["customer_id"])
    op.create_index("ix_customer_contacts_customer_location_id", "customer_contacts", ["customer_location_id"])
    op.create_index("ix_customer_contacts_last_name", "customer_contacts", ["last_name"])

    with op.batch_alter_table("goods_issues") as batch_op:
        batch_op.add_column(sa.Column("customer_location_id", sa.Integer(), nullable=True))
        batch_op.create_index("ix_goods_issues_customer_location_id", ["customer_location_id"])
        batch_op.create_foreign_key(
            "fk_goods_issues_customer_location_id_customer_locations",
            "customer_locations",
            ["customer_location_id"],
            ["id"],
            ondelete="SET NULL",
        )

    with op.batch_alter_table("sales_orders") as batch_op:
        batch_op.add_column(sa.Column("customer_location_id", sa.Integer(), nullable=True))
        batch_op.create_index("ix_sales_orders_customer_location_id", ["customer_location_id"])
        batch_op.create_foreign_key(
            "fk_sales_orders_customer_location_id_customer_locations",
            "customer_locations",
            ["customer_location_id"],
            ["id"],
            ondelete="SET NULL",
        )

    with op.batch_alter_table("shipments") as batch_op:
        batch_op.add_column(sa.Column("customer_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("customer_location_id", sa.Integer(), nullable=True))
        batch_op.create_index("ix_shipments_customer_id", ["customer_id"])
        batch_op.create_index("ix_shipments_customer_location_id", ["customer_location_id"])
        batch_op.create_foreign_key(
            "fk_shipments_customer_id_customers",
            "customers",
            ["customer_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_foreign_key(
            "fk_shipments_customer_location_id_customer_locations",
            "customer_locations",
            ["customer_location_id"],
            ["id"],
            ondelete="SET NULL",
        )

    bind = op.get_bind()

    # Requested data strategy: drop all existing customer records and start clean.
    bind.execute(sa.text("DELETE FROM customers"))

    bind.execute(
        sa.text(
            """
            INSERT INTO app_pages (slug, title, description, created_at, updated_at)
            VALUES ('customers', 'Kunden', 'Kundenstamm mit Standorten und Ansprechpartnern', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (slug) DO UPDATE
            SET title = EXCLUDED.title,
                description = EXCLUDED.description,
                updated_at = CURRENT_TIMESTAMP
            """
        )
    )
    bind.execute(
        sa.text(
            """
            INSERT INTO permissions (code, description, created_at, updated_at)
            VALUES ('page.customers.view', 'View access for page ''customers''', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (code) DO UPDATE
            SET description = EXCLUDED.description,
                updated_at = CURRENT_TIMESTAMP
            """
        )
    )
    bind.execute(
        sa.text(
            """
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM roles r
            JOIN permissions p ON p.code = 'page.customers.view'
            WHERE r.name IN ('admin', 'lagerleiter', 'versand')
              AND NOT EXISTS (
                SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
              )
            """
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            DELETE FROM role_permissions
            WHERE permission_id IN (
                SELECT id FROM permissions WHERE code = 'page.customers.view'
            )
            """
        )
    )
    bind.execute(sa.text("DELETE FROM permissions WHERE code = 'page.customers.view'"))
    bind.execute(sa.text("DELETE FROM app_pages WHERE slug = 'customers'"))

    with op.batch_alter_table("shipments") as batch_op:
        batch_op.drop_constraint("fk_shipments_customer_location_id_customer_locations", type_="foreignkey")
        batch_op.drop_constraint("fk_shipments_customer_id_customers", type_="foreignkey")
        batch_op.drop_index("ix_shipments_customer_location_id")
        batch_op.drop_index("ix_shipments_customer_id")
        batch_op.drop_column("customer_location_id")
        batch_op.drop_column("customer_id")

    with op.batch_alter_table("sales_orders") as batch_op:
        batch_op.drop_constraint("fk_sales_orders_customer_location_id_customer_locations", type_="foreignkey")
        batch_op.drop_index("ix_sales_orders_customer_location_id")
        batch_op.drop_column("customer_location_id")

    with op.batch_alter_table("goods_issues") as batch_op:
        batch_op.drop_constraint("fk_goods_issues_customer_location_id_customer_locations", type_="foreignkey")
        batch_op.drop_index("ix_goods_issues_customer_location_id")
        batch_op.drop_column("customer_location_id")

    op.drop_index("ix_customer_contacts_last_name", table_name="customer_contacts")
    op.drop_index("ix_customer_contacts_customer_location_id", table_name="customer_contacts")
    op.drop_index("ix_customer_contacts_customer_id", table_name="customer_contacts")
    op.drop_table("customer_contacts")

    op.drop_index("ix_customer_locations_city", table_name="customer_locations")
    op.drop_index("ix_customer_locations_postal_code", table_name="customer_locations")
    op.drop_index("ix_customer_locations_name", table_name="customer_locations")
    op.drop_index("ix_customer_locations_customer_id", table_name="customer_locations")
    op.drop_table("customer_locations")
