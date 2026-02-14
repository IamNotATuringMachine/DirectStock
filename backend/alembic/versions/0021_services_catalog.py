"""phase5 services catalog

Revision ID: 0021_services_catalog
Revises: 0020_pricing_domain
Create Date: 2026-02-14

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "0021_services_catalog"
down_revision: Union[str, None] = "0020_pricing_domain"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
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


def downgrade() -> None:
    op.drop_index("ix_services_status", table_name="services")
    op.drop_index("ix_services_name", table_name="services")
    op.drop_index("ix_services_service_number", table_name="services")
    op.drop_table("services")
