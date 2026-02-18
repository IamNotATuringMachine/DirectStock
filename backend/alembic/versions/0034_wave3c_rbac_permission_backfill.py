"""wave 3c rbac permission backfill for remaining routers

Revision ID: 0034_wave3c_rbac_backfill
Revises: 0033_wave3b_rbac_backfill
Create Date: 2026-02-18

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "0034_wave3c_rbac_backfill"
down_revision: Union[str, None] = "0033_wave3b_rbac_backfill"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


PERMISSIONS: tuple[tuple[str, str], ...] = (
    ("module.purchase_recommendations.read", "Read purchase recommendations"),
    ("module.purchase_recommendations.write", "Write purchase recommendations"),
    ("module.product_settings.read", "Read product settings"),
    ("module.product_settings.write", "Write product settings"),
    ("module.abc.read", "Read ABC classifications"),
    ("module.abc.write", "Write ABC classifications"),
    ("module.audit_log.read", "Read audit log"),
)

ROLE_PERMISSION_ASSIGNMENTS: tuple[tuple[str, str], ...] = (
    ("admin", "module.purchase_recommendations.read"),
    ("lagerleiter", "module.purchase_recommendations.read"),
    ("einkauf", "module.purchase_recommendations.read"),
    ("controller", "module.purchase_recommendations.read"),
    ("auditor", "module.purchase_recommendations.read"),
    ("admin", "module.purchase_recommendations.write"),
    ("lagerleiter", "module.purchase_recommendations.write"),
    ("einkauf", "module.purchase_recommendations.write"),
    ("admin", "module.product_settings.read"),
    ("lagerleiter", "module.product_settings.read"),
    ("einkauf", "module.product_settings.read"),
    ("admin", "module.product_settings.write"),
    ("lagerleiter", "module.product_settings.write"),
    ("einkauf", "module.product_settings.write"),
    ("admin", "module.abc.read"),
    ("lagerleiter", "module.abc.read"),
    ("einkauf", "module.abc.read"),
    ("controller", "module.abc.read"),
    ("auditor", "module.abc.read"),
    ("admin", "module.abc.write"),
    ("lagerleiter", "module.abc.write"),
    ("einkauf", "module.abc.write"),
    ("admin", "module.audit_log.read"),
    ("lagerleiter", "module.audit_log.read"),
    ("controller", "module.audit_log.read"),
    ("auditor", "module.audit_log.read"),
)

NEW_PERMISSION_CODES: tuple[str, ...] = (
    "module.purchase_recommendations.read",
    "module.purchase_recommendations.write",
    "module.product_settings.read",
    "module.product_settings.write",
    "module.abc.read",
    "module.abc.write",
    "module.audit_log.read",
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
