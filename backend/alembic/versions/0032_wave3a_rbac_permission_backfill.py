"""wave 3a rbac permission backfill for returns/purchasing/warehouses

Revision ID: 0032_wave3a_rbac_backfill
Revises: 0031_goods_receipt_modes_input
Create Date: 2026-02-18

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "0032_wave3a_rbac_backfill"
down_revision: Union[str, None] = "0031_goods_receipt_modes_input"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


PERMISSIONS: tuple[tuple[str, str], ...] = (
    ("module.returns.read", "Read returns"),
    ("module.returns.write", "Write returns"),
    ("module.purchasing.read", "Read purchasing"),
    ("module.purchasing.write", "Write purchasing"),
    ("module.warehouses.read", "Read warehouses"),
    ("module.warehouses.write", "Write warehouses"),
)

ROLE_PERMISSION_ASSIGNMENTS: tuple[tuple[str, str], ...] = (
    ("admin", "module.returns.read"),
    ("lagerleiter", "module.returns.read"),
    ("versand", "module.returns.read"),
    ("controller", "module.returns.read"),
    ("auditor", "module.returns.read"),
    ("admin", "module.returns.write"),
    ("lagerleiter", "module.returns.write"),
    ("versand", "module.returns.write"),
    ("admin", "module.purchasing.read"),
    ("lagerleiter", "module.purchasing.read"),
    ("einkauf", "module.purchasing.read"),
    ("admin", "module.purchasing.write"),
    ("lagerleiter", "module.purchasing.write"),
    ("einkauf", "module.purchasing.write"),
    ("admin", "module.warehouses.write"),
    ("lagerleiter", "module.warehouses.write"),
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

    for code, _description in PERMISSIONS:
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
