from __future__ import annotations

from sqlalchemy import delete, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth import Permission, Role, role_permissions
from app.models.phase5 import AppPage, DashboardCard, RoleDashboardPolicy

PHASE5_PAGES: list[tuple[str, str, str]] = [
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
    ("customers", "Kunden", "Kundenstamm mit Standorten und Ansprechpartnern"),
    ("scanner", "Scanner", "Scan Workflows"),
    ("users", "Benutzerverwaltung", "User- und Rollenverwaltung"),
    ("sales-orders", "Verkaufsaufträge", "Sales Orders"),
    ("invoices", "Rechnungen", "Invoicing"),
]

PHASE5_MODULE_PERMISSIONS: list[tuple[str, str]] = [
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
    ("module.sales_orders.read", "Read sales orders"),
    ("module.sales_orders.write", "Write sales orders"),
    ("module.invoices.read", "Read invoices"),
    ("module.invoices.write", "Write invoices"),
    ("module.invoices.export", "Export invoices"),
    ("module.goods_receipts.read", "Read goods receipt operations"),
    ("module.goods_receipts.write", "Write goods receipt operations"),
    ("module.operations.goods_issues.read", "Read goods issue operations"),
    ("module.operations.goods_issues.write", "Write goods issue operations"),
    ("module.operations.stock_transfers.read", "Read stock transfer operations"),
    ("module.operations.stock_transfers.write", "Write stock transfer operations"),
    ("module.reports.read", "Read reports"),
    ("module.reports.write", "Recompute report data"),
    ("module.inventory.read", "Read inventory"),
    ("module.inventory.write", "Write inventory"),
    ("module.warehouses.read", "Read warehouses"),
    ("module.warehouses.write", "Write warehouses"),
    ("module.customers.read", "Read customers"),
    ("module.customers.write", "Write customers"),
    ("module.suppliers.read", "Read suppliers"),
    ("module.suppliers.write", "Write suppliers"),
    ("module.shipping.read", "Read shipping"),
    ("module.shipping.write", "Write shipping"),
    ("module.returns.read", "Read returns"),
    ("module.returns.write", "Write returns"),
    ("module.picking.read", "Read picking"),
    ("module.picking.write", "Write picking"),
    ("module.documents.read", "Read documents"),
    ("module.documents.write", "Write documents"),
    ("module.alerts.read", "Read alerts"),
    ("module.alerts.write", "Write alerts"),
    ("module.purchasing.read", "Read purchasing"),
    ("module.purchasing.write", "Write purchasing"),
    ("module.purchase_recommendations.read", "Read purchase recommendations"),
    ("module.purchase_recommendations.write", "Write purchase recommendations"),
    ("module.inventory_counts.read", "Read inventory counts"),
    ("module.inventory_counts.write", "Write inventory counts"),
    ("module.inventory_counts.cancel", "Cancel inventory counts"),
    ("module.product_settings.read", "Read product settings"),
    ("module.product_settings.write", "Write product settings"),
    ("module.abc.read", "Read ABC classifications"),
    ("module.abc.write", "Write ABC classifications"),
    ("module.audit_log.read", "Read audit log"),
    ("module.approval_rules.read", "Read approval rules"),
    ("module.approval_rules.write", "Write approval rules"),
    ("module.approvals.read", "Read approvals"),
    ("module.approvals.write", "Write approvals"),
    ("module.inter_warehouse_transfers.read", "Read inter-warehouse transfers"),
    ("module.inter_warehouse_transfers.write", "Write inter-warehouse transfers"),
    ("module.products.quick_create", "Create products from goods receipt workflow"),
]

PHASE5_ROLE_MODULE_PERMISSIONS: dict[str, set[str]] = {
    "admin": {"*"},
    "lagerleiter": {
        "module.permissions.read",
        "module.pages.read",
        "module.ui_preferences.manage_self",
        "module.dashboard_config.read",
        "module.dashboard_config.manage_self",
        "module.pricing.read",
        "module.pricing.write",
        "module.sales_orders.read",
        "module.sales_orders.write",
        "module.invoices.read",
        "module.invoices.write",
        "module.invoices.export",
        "module.goods_receipts.read",
        "module.goods_receipts.write",
        "module.operations.goods_issues.read",
        "module.operations.goods_issues.write",
        "module.operations.stock_transfers.read",
        "module.operations.stock_transfers.write",
        "module.reports.read",
        "module.reports.write",
        "module.inventory.read",
        "module.inventory.write",
        "module.warehouses.read",
        "module.warehouses.write",
        "module.customers.read",
        "module.customers.write",
        "module.suppliers.read",
        "module.suppliers.write",
        "module.shipping.read",
        "module.shipping.write",
        "module.returns.read",
        "module.returns.write",
        "module.picking.read",
        "module.picking.write",
        "module.documents.read",
        "module.documents.write",
        "module.alerts.read",
        "module.alerts.write",
        "module.purchasing.read",
        "module.purchasing.write",
        "module.purchase_recommendations.read",
        "module.purchase_recommendations.write",
        "module.inventory_counts.read",
        "module.inventory_counts.write",
        "module.inventory_counts.cancel",
        "module.product_settings.read",
        "module.product_settings.write",
        "module.abc.read",
        "module.abc.write",
        "module.audit_log.read",
        "module.approval_rules.read",
        "module.approval_rules.write",
        "module.approvals.read",
        "module.approvals.write",
        "module.inter_warehouse_transfers.read",
        "module.inter_warehouse_transfers.write",
    },
    "lagermitarbeiter": {
        "module.permissions.read",
        "module.pages.read",
        "module.ui_preferences.manage_self",
        "module.dashboard_config.read",
        "module.dashboard_config.manage_self",
        "module.sales_orders.read",
        "module.goods_receipts.read",
        "module.goods_receipts.write",
        "module.operations.goods_issues.read",
        "module.operations.goods_issues.write",
        "module.operations.stock_transfers.read",
        "module.operations.stock_transfers.write",
        "module.inventory.read",
        "module.warehouses.read",
        "module.picking.read",
        "module.picking.write",
        "module.alerts.read",
        "module.inventory_counts.read",
        "module.inventory_counts.write",
        "module.inter_warehouse_transfers.read",
        "module.inter_warehouse_transfers.write",
    },
    "einkauf": {
        "module.permissions.read",
        "module.pages.read",
        "module.ui_preferences.manage_self",
        "module.dashboard_config.read",
        "module.dashboard_config.manage_self",
        "module.pricing.read",
        "module.pricing.write",
        "module.sales_orders.read",
        "module.sales_orders.write",
        "module.invoices.read",
        "module.goods_receipts.read",
        "module.goods_receipts.write",
        "module.purchasing.read",
        "module.purchasing.write",
        "module.purchase_recommendations.read",
        "module.purchase_recommendations.write",
        "module.product_settings.read",
        "module.product_settings.write",
        "module.suppliers.read",
        "module.suppliers.write",
        "module.customers.read",
        "module.reports.read",
        "module.abc.read",
        "module.abc.write",
        "module.inventory.read",
        "module.documents.read",
        "module.alerts.read",
        "module.alerts.write",
        "module.approval_rules.read",
        "module.approvals.read",
        "module.approvals.write",
    },
    "versand": {
        "module.permissions.read",
        "module.pages.read",
        "module.ui_preferences.manage_self",
        "module.dashboard_config.read",
        "module.dashboard_config.manage_self",
        "module.sales_orders.read",
        "module.sales_orders.write",
        "module.invoices.read",
        "module.invoices.write",
        "module.invoices.export",
        "module.operations.goods_issues.read",
        "module.operations.goods_issues.write",
        "module.shipping.read",
        "module.shipping.write",
        "module.picking.read",
        "module.picking.write",
        "module.alerts.read",
        "module.returns.read",
        "module.returns.write",
        "module.documents.read",
        "module.documents.write",
        "module.customers.read",
        "module.customers.write",
        "module.approvals.read",
        "module.approvals.write",
    },
    "controller": {
        "module.permissions.read",
        "module.pages.read",
        "module.ui_preferences.manage_self",
        "module.dashboard_config.read",
        "module.dashboard_config.manage_self",
        "module.pricing.read",
        "module.sales_orders.read",
        "module.invoices.read",
        "module.reports.read",
        "module.purchase_recommendations.read",
        "module.abc.read",
        "module.inventory.read",
        "module.audit_log.read",
        "module.documents.read",
        "module.alerts.read",
        "module.alerts.write",
        "module.returns.read",
        "module.approval_rules.read",
        "module.approvals.read",
    },
    "auditor": {
        "module.permissions.read",
        "module.pages.read",
        "module.ui_preferences.manage_self",
        "module.dashboard_config.read",
        "module.dashboard_config.manage_self",
        "module.pricing.read",
        "module.sales_orders.read",
        "module.invoices.read",
        "module.reports.read",
        "module.purchase_recommendations.read",
        "module.abc.read",
        "module.audit_log.read",
        "module.documents.read",
        "module.returns.read",
        "module.picking.read",
        "module.approval_rules.read",
        "module.approvals.read",
        "module.inter_warehouse_transfers.read",
    },
}

PHASE5_ROLE_PAGE_ACCESS: dict[str, set[str]] = {
    "admin": {slug for slug, _, _ in PHASE5_PAGES},
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
        "customers",
        "scanner",
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
        "customers",
        "scanner",
        "sales-orders",
        "invoices",
    },
    "controller": {"dashboard", "documents", "audit-trail", "reports", "alerts", "sales-orders", "invoices"},
    "auditor": {"documents", "audit-trail", "reports", "sales-orders", "invoices"},
}

PHASE5_DASHBOARD_CARDS: list[tuple[str, str, str, int]] = [
    ("summary", "Zusammenfassung", "Kernmetriken", 10),
    ("capacity", "Kapazität", "Lagerplatzauslastung", 20),
    ("quick-actions", "Quick Actions", "Schnellzugriffe", 30),
    ("recent-movements", "Letzte Bewegungen", "Neueste Bewegungsbuchungen", 40),
    ("low-stock", "Niedrige Bestände", "Kritische Bestände", 50),
    ("activity-today", "Aktivität heute", "Tagesaktivität", 60),
    ("critical-alerts", "Kritische Alerts", "Offene kritische Alerts", 70),
]


async def _seed_phase5_rbac_and_dashboard(db: AsyncSession, role_map: dict[str, Role]) -> None:
    existing_permissions = {
        permission.code: permission for permission in (await db.execute(select(Permission))).scalars()
    }
    existing_pages = {page.slug: page for page in (await db.execute(select(AppPage))).scalars()}
    existing_cards = {card.card_key: card for card in (await db.execute(select(DashboardCard))).scalars()}

    permissions: list[tuple[str, str]] = [
        *[(f"page.{slug}.view", f"View access for page '{slug}'") for slug, _, _ in PHASE5_PAGES],
        *PHASE5_MODULE_PERMISSIONS,
    ]

    for code, description in permissions:
        permission = existing_permissions.get(code)
        if permission is None:
            permission = Permission(code=code, description=description)
            db.add(permission)
            existing_permissions[code] = permission
        else:
            permission.description = description

    for slug, title, description in PHASE5_PAGES:
        page = existing_pages.get(slug)
        if page is None:
            page = AppPage(slug=slug, title=title, description=description)
            db.add(page)
            existing_pages[slug] = page
        else:
            page.title = title
            page.description = description

    await db.flush()

    all_permission_codes = set(existing_permissions.keys())
    for role_name, role in role_map.items():
        modules = PHASE5_ROLE_MODULE_PERMISSIONS.get(role_name, set())
        pages = PHASE5_ROLE_PAGE_ACCESS.get(role_name, set())

        desired_codes: set[str]
        if "*" in modules:
            desired_codes = set(all_permission_codes)
        else:
            desired_codes = set(modules)
            desired_codes.update({f"page.{slug}.view" for slug in pages})

        desired_permission_ids = [
            existing_permissions[code].id for code in sorted(desired_codes) if code in existing_permissions
        ]
        await db.execute(delete(role_permissions).where(role_permissions.c.role_id == role.id))
        if desired_permission_ids:
            await db.execute(
                insert(role_permissions),
                [{"role_id": role.id, "permission_id": permission_id} for permission_id in desired_permission_ids],
            )

    for card_key, title, description, default_order in PHASE5_DASHBOARD_CARDS:
        card = existing_cards.get(card_key)
        if card is None:
            card = DashboardCard(
                card_key=card_key,
                title=title,
                description=description,
                default_order=default_order,
                is_active=True,
            )
            db.add(card)
            existing_cards[card_key] = card
        else:
            card.title = title
            card.description = description
            card.default_order = default_order
            card.is_active = True

    await db.flush()

    existing_policies = {
        (policy.role_id, policy.card_key): policy
        for policy in (await db.execute(select(RoleDashboardPolicy))).scalars()
    }
    for role in role_map.values():
        for card_key, _, _, _ in PHASE5_DASHBOARD_CARDS:
            key = (role.id, card_key)
            policy = existing_policies.get(key)
            if policy is None:
                policy = RoleDashboardPolicy(
                    role_id=role.id,
                    card_key=card_key,
                    allowed=True,
                    default_visible=True,
                    locked=False,
                )
                db.add(policy)
            else:
                policy.allowed = True
                policy.default_visible = True
                policy.locked = False
