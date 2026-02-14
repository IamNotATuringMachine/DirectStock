"""phase5 rbac permissions and app pages

Revision ID: 0018_rbac_permissions_pages
Revises: 0017_legacy_raw_records
Create Date: 2026-02-14

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "0018_rbac_permissions_pages"
down_revision: Union[str, None] = "0017_legacy_raw_records"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


PAGES: list[tuple[str, str, str]] = [
    ("dashboard", "Dashboard", "Operativer Überblick"),
    ("products", "Artikelstamm", "Produktverwaltung"),
    ("warehouse", "Lagerstruktur", "Lager- und Platzverwaltung"),
    ("inventory", "Bestandsübersicht", "Bestand und Verfügbarkeit"),
    ("inventory-counts", "Inventur", "Inventurprozesse"),
    ("purchasing", "Einkauf", "Beschaffung und Bestellungen"),
    ("picking", "Picking", "Kommissionierung"),
    ("returns", "Retouren", "Retouren- und RMA-Prozesse"),
    ("approvals", "Genehmigungen", "Freigaben und Workflows"),
    ("documents", "Dokumente", "Dokumentenablage"),
    ("audit-trail", "Audit Trail", "Compliance Auditlog"),
    ("reports", "Reports", "Berichte und KPIs"),
    ("alerts", "Alerts", "Warnungen und Benachrichtigungen"),
    ("goods-receipt", "Wareneingang", "WE-Prozesse"),
    ("goods-issue", "Warenausgang", "WA-Prozesse"),
    ("stock-transfer", "Umlagerung", "Intra-Warehouse Umlagerung"),
    ("inter-warehouse-transfer", "Inter-Warehouse", "Standortübergreifende Umlagerung"),
    ("shipping", "Shipping", "Versand"),
    ("scanner", "Scanner", "Scan Workflows"),
    ("users", "Benutzerverwaltung", "User- und Rollenverwaltung"),
    ("services", "Dienstleistungen", "Service-Katalog"),
    ("sales-orders", "Verkaufsaufträge", "Sales Orders"),
    ("invoices", "Rechnungen", "Invoicing"),
]


def _page_view_permissions() -> list[tuple[str, str]]:
    return [(f"page.{slug}.view", f"View access for page '{slug}'") for slug, _, _ in PAGES]


MODULE_PERMISSIONS: list[tuple[str, str]] = [
    ("module.roles.read", "Read roles"),
    ("module.roles.manage", "Create/update/delete roles"),
    ("module.permissions.read", "Read permission catalog"),
    ("module.pages.read", "Read page catalog"),
    ("module.ui_preferences.manage_self", "Manage own UI preferences"),
    ("module.dashboard_config.read", "Read dashboard config catalog"),
    ("module.dashboard_config.manage_self", "Manage own dashboard config"),
    ("module.dashboard_config.manage_role", "Manage role dashboard policies"),
    ("module.pricing.read", "Read pricing"),
    ("module.pricing.write", "Write pricing"),
    ("module.services.read", "Read services"),
    ("module.services.write", "Write services"),
    ("module.sales_orders.read", "Read sales orders"),
    ("module.sales_orders.write", "Write sales orders"),
    ("module.invoices.read", "Read invoices"),
    ("module.invoices.write", "Write invoices"),
    ("module.invoices.export", "Export invoices"),
]


ROLE_ASSIGNMENTS: dict[str, list[str]] = {
    "admin": ["*"],
    "lagerleiter": [
        "module.permissions.read",
        "module.pages.read",
        "module.ui_preferences.manage_self",
        "module.dashboard_config.read",
        "module.dashboard_config.manage_self",
        "module.pricing.read",
        "module.pricing.write",
        "module.services.read",
        "module.services.write",
        "module.sales_orders.read",
        "module.sales_orders.write",
        "module.invoices.read",
        "module.invoices.write",
        "module.invoices.export",
    ],
    "lagermitarbeiter": [
        "module.permissions.read",
        "module.pages.read",
        "module.ui_preferences.manage_self",
        "module.dashboard_config.read",
        "module.dashboard_config.manage_self",
        "module.sales_orders.read",
    ],
    "einkauf": [
        "module.permissions.read",
        "module.pages.read",
        "module.ui_preferences.manage_self",
        "module.dashboard_config.read",
        "module.dashboard_config.manage_self",
        "module.pricing.read",
        "module.pricing.write",
        "module.services.read",
        "module.sales_orders.read",
        "module.sales_orders.write",
        "module.invoices.read",
    ],
    "versand": [
        "module.permissions.read",
        "module.pages.read",
        "module.ui_preferences.manage_self",
        "module.dashboard_config.read",
        "module.dashboard_config.manage_self",
        "module.services.read",
        "module.sales_orders.read",
        "module.sales_orders.write",
        "module.invoices.read",
        "module.invoices.write",
        "module.invoices.export",
    ],
    "controller": [
        "module.permissions.read",
        "module.pages.read",
        "module.ui_preferences.manage_self",
        "module.dashboard_config.read",
        "module.dashboard_config.manage_self",
        "module.pricing.read",
        "module.services.read",
        "module.sales_orders.read",
        "module.invoices.read",
    ],
    "auditor": [
        "module.permissions.read",
        "module.pages.read",
        "module.ui_preferences.manage_self",
        "module.dashboard_config.read",
        "module.dashboard_config.manage_self",
        "module.pricing.read",
        "module.services.read",
        "module.sales_orders.read",
        "module.invoices.read",
    ],
}


ROLE_PAGE_ACCESS: dict[str, set[str]] = {
    "admin": {slug for slug, _, _ in PAGES},
    "lagerleiter": {
        "dashboard",
        "products",
        "warehouse",
        "inventory",
        "inventory-counts",
        "purchasing",
        "picking",
        "returns",
        "approvals",
        "documents",
        "audit-trail",
        "reports",
        "alerts",
        "goods-receipt",
        "goods-issue",
        "stock-transfer",
        "inter-warehouse-transfer",
        "shipping",
        "scanner",
        "services",
        "sales-orders",
        "invoices",
    },
    "lagermitarbeiter": {
        "dashboard",
        "products",
        "warehouse",
        "inventory",
        "inventory-counts",
        "picking",
        "alerts",
        "goods-receipt",
        "goods-issue",
        "stock-transfer",
        "inter-warehouse-transfer",
        "scanner",
        "sales-orders",
    },
    "einkauf": {
        "dashboard",
        "products",
        "inventory",
        "purchasing",
        "approvals",
        "documents",
        "reports",
        "alerts",
        "goods-receipt",
        "scanner",
        "services",
        "sales-orders",
        "invoices",
    },
    "versand": {
        "dashboard",
        "products",
        "inventory",
        "picking",
        "returns",
        "approvals",
        "documents",
        "alerts",
        "goods-issue",
        "shipping",
        "scanner",
        "services",
        "sales-orders",
        "invoices",
    },
    "controller": {
        "dashboard",
        "documents",
        "audit-trail",
        "reports",
        "alerts",
        "services",
        "sales-orders",
        "invoices",
    },
    "auditor": {"documents", "audit-trail", "reports", "invoices", "sales-orders"},
}


def _ensure_permission(bind, code: str, description: str) -> None:
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


def _seed_role_permissions(bind) -> None:
    role_ids = {
        row.name: row.id
        for row in bind.execute(sa.text("SELECT id, name FROM roles"))
    }
    permission_ids = {
        row.code: row.id
        for row in bind.execute(sa.text("SELECT id, code FROM permissions"))
    }

    for role_name, assignments in ROLE_ASSIGNMENTS.items():
        role_id = role_ids.get(role_name)
        if role_id is None:
            continue

        codes: set[str]
        if "*" in assignments:
            codes = set(permission_ids)
        else:
            codes = set(assignments)

        codes.update({f"page.{slug}.view" for slug in ROLE_PAGE_ACCESS.get(role_name, set())})

        for code in codes:
            permission_id = permission_ids.get(code)
            if permission_id is None:
                continue
            bind.execute(
                sa.text(
                    """
                    INSERT INTO role_permissions (role_id, permission_id)
                    SELECT :role_id, :permission_id
                    WHERE NOT EXISTS (
                        SELECT 1 FROM role_permissions
                        WHERE role_id = :role_id AND permission_id = :permission_id
                    )
                    """
                ),
                {"role_id": role_id, "permission_id": permission_id},
            )


def upgrade() -> None:
    op.create_table(
        "app_pages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("slug", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="uq_app_pages_slug"),
    )
    op.create_index("ix_app_pages_slug", "app_pages", ["slug"])

    bind = op.get_bind()

    for slug, title, description in PAGES:
        bind.execute(
            sa.text(
                """
                INSERT INTO app_pages (slug, title, description, created_at, updated_at)
                VALUES (:slug, :title, :description, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (slug) DO UPDATE
                SET title = EXCLUDED.title,
                    description = EXCLUDED.description,
                    updated_at = CURRENT_TIMESTAMP
                """
            ),
            {"slug": slug, "title": title, "description": description},
        )

    for code, description in _page_view_permissions() + MODULE_PERMISSIONS:
        _ensure_permission(bind, code=code, description=description)

    _seed_role_permissions(bind)


def downgrade() -> None:
    bind = op.get_bind()

    codes = [code for code, _ in _page_view_permissions() + MODULE_PERMISSIONS]
    for code in codes:
        bind.execute(
            sa.text(
                "DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code = :code)"
            ),
            {"code": code},
        )
        bind.execute(sa.text("DELETE FROM permissions WHERE code = :code"), {"code": code})

    op.drop_index("ix_app_pages_slug", table_name="app_pages")
    op.drop_table("app_pages")
