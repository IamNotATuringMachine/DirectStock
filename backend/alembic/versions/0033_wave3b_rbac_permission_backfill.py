"""wave 3b rbac permission backfill for inventory/alerts/picking/workflows/iwt

Revision ID: 0033_wave3b_rbac_backfill
Revises: 0032_wave3a_rbac_backfill
Create Date: 2026-02-18

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "0033_wave3b_rbac_backfill"
down_revision: Union[str, None] = "0032_wave3a_rbac_backfill"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


PERMISSIONS: tuple[tuple[str, str], ...] = (
    ("module.inventory_counts.read", "Read inventory counts"),
    ("module.inventory_counts.write", "Write inventory counts"),
    ("module.inventory_counts.cancel", "Cancel inventory counts"),
    ("module.alerts.read", "Read alerts"),
    ("module.alerts.write", "Write alerts"),
    ("module.picking.read", "Read picking"),
    ("module.picking.write", "Write picking"),
    ("module.approval_rules.read", "Read approval rules"),
    ("module.approval_rules.write", "Write approval rules"),
    ("module.approvals.read", "Read approvals"),
    ("module.approvals.write", "Write approvals"),
    ("module.inter_warehouse_transfers.read", "Read inter-warehouse transfers"),
    ("module.inter_warehouse_transfers.write", "Write inter-warehouse transfers"),
)

ROLE_PERMISSION_ASSIGNMENTS: tuple[tuple[str, str], ...] = (
    ("admin", "module.inventory_counts.read"),
    ("lagerleiter", "module.inventory_counts.read"),
    ("lagermitarbeiter", "module.inventory_counts.read"),
    ("admin", "module.inventory_counts.write"),
    ("lagerleiter", "module.inventory_counts.write"),
    ("lagermitarbeiter", "module.inventory_counts.write"),
    ("admin", "module.inventory_counts.cancel"),
    ("lagerleiter", "module.inventory_counts.cancel"),
    ("admin", "module.alerts.read"),
    ("lagerleiter", "module.alerts.read"),
    ("lagermitarbeiter", "module.alerts.read"),
    ("einkauf", "module.alerts.read"),
    ("controller", "module.alerts.read"),
    ("versand", "module.alerts.read"),
    ("admin", "module.alerts.write"),
    ("lagerleiter", "module.alerts.write"),
    ("einkauf", "module.alerts.write"),
    ("controller", "module.alerts.write"),
    ("admin", "module.picking.read"),
    ("lagerleiter", "module.picking.read"),
    ("lagermitarbeiter", "module.picking.read"),
    ("versand", "module.picking.read"),
    ("auditor", "module.picking.read"),
    ("admin", "module.picking.write"),
    ("lagerleiter", "module.picking.write"),
    ("lagermitarbeiter", "module.picking.write"),
    ("versand", "module.picking.write"),
    ("admin", "module.approval_rules.read"),
    ("lagerleiter", "module.approval_rules.read"),
    ("einkauf", "module.approval_rules.read"),
    ("controller", "module.approval_rules.read"),
    ("auditor", "module.approval_rules.read"),
    ("admin", "module.approval_rules.write"),
    ("lagerleiter", "module.approval_rules.write"),
    ("admin", "module.approvals.read"),
    ("lagerleiter", "module.approvals.read"),
    ("einkauf", "module.approvals.read"),
    ("versand", "module.approvals.read"),
    ("controller", "module.approvals.read"),
    ("auditor", "module.approvals.read"),
    ("admin", "module.approvals.write"),
    ("lagerleiter", "module.approvals.write"),
    ("einkauf", "module.approvals.write"),
    ("versand", "module.approvals.write"),
    ("admin", "module.inter_warehouse_transfers.read"),
    ("lagerleiter", "module.inter_warehouse_transfers.read"),
    ("lagermitarbeiter", "module.inter_warehouse_transfers.read"),
    ("auditor", "module.inter_warehouse_transfers.read"),
    ("admin", "module.inter_warehouse_transfers.write"),
    ("lagerleiter", "module.inter_warehouse_transfers.write"),
    ("lagermitarbeiter", "module.inter_warehouse_transfers.write"),
)

NEW_PERMISSION_CODES: tuple[str, ...] = (
    "module.inventory_counts.cancel",
    "module.approval_rules.read",
    "module.approval_rules.write",
    "module.approvals.read",
    "module.approvals.write",
    "module.inter_warehouse_transfers.read",
    "module.inter_warehouse_transfers.write",
)


def upgrade() -> None:
    bind = op.get_bind()

    for code, description in PERMISSIONS:
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

    for role_name, permission_code in ROLE_PERMISSION_ASSIGNMENTS:
        bind.execute(
            sa.text(
                """
                INSERT INTO role_permissions (role_id, permission_id)
                SELECT r.id, p.id
                FROM roles r
                JOIN permissions p ON p.code = :permission_code
                WHERE r.name = :role_name
                  AND NOT EXISTS (
                    SELECT 1
                    FROM role_permissions rp
                    WHERE rp.role_id = r.id AND rp.permission_id = p.id
                  )
                """
            ),
            {"role_name": role_name, "permission_code": permission_code},
        )


def downgrade() -> None:
    bind = op.get_bind()

    for role_name, permission_code in ROLE_PERMISSION_ASSIGNMENTS:
        bind.execute(
            sa.text(
                """
                DELETE FROM role_permissions
                WHERE role_id = (SELECT id FROM roles WHERE name = :role_name)
                  AND permission_id = (SELECT id FROM permissions WHERE code = :permission_code)
                """
            ),
            {"role_name": role_name, "permission_code": permission_code},
        )

    for code in NEW_PERMISSION_CODES:
        bind.execute(
            sa.text(
                """
                DELETE FROM permissions
                WHERE code = :code
                  AND NOT EXISTS (
                    SELECT 1 FROM role_permissions rp WHERE rp.permission_id = permissions.id
                  )
                  AND NOT EXISTS (
                    SELECT 1 FROM user_permission_overrides upo WHERE upo.permission_id = permissions.id
                  )
                """
            ),
            {"code": code},
        )
